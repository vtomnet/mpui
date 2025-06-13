const loading = document.getElementById('loading');
const speakBtn = document.getElementById('speakBtn');

function showLoading() { loading.classList.add('show'); }
function hideLoading() { loading.classList.remove('show'); }

function x(task) {
  const seq = [].concat(task.ActionSequence.Sequence.TaskID);
  const locMap = {};
  for (const at of [].concat(task.AtomicTasks.AtomicTask)) {
      if (at.Action.ActionType === 'moveToLocation') {
          const m = at.Action.moveToLocation;
          locMap[at.TaskID] = [Number(m.Latitude), Number(m.Longitude)];
      }
  }

  const waypoints = seq.filter(id => id in locMap).map(id => locMap[id]);

  const [lat0, lon0] = waypoints[0];
  const degToRad     = Math.PI / 180;
  const kLat         = 111_320;                     // m per ° latitude
  const kLon         = 111_320 * Math.cos(lat0*degToRad);      // m per ° longitude
  const metres = waypoints.map(([lat, lon]) => [
    (lon - lon0) * kLon,            // x  (east +)
    (lat - lat0) * kLat * -1        // y  (south + on canvas)
  ]);

  // Fit bounding box into canvas with padding
  const cvs   = document.getElementById('field');
  const ctx   = cvs.getContext('2d');
  const pad   = 60;
  const xs    = metres.map(p => p[0]);
  const ys    = metres.map(p => p[1]);
  const spanX = Math.max(...xs) - Math.min(...xs) || 1;
  const spanY = Math.max(...ys) - Math.min(...ys) || 1;
  const sx    = (cvs.width  - 2*pad) / spanX;
  const sy    = (cvs.height - 2*pad) / spanY;
  function toPx([x,y]) {
    return [
      pad + (x - Math.min(...xs)) * sx,
      pad + (y - Math.min(...ys)) * sy
    ];
  }

  const background = new Image();
  background.src = "background.png";

  background.onload = () => {
    ctx.drawImage(background, 0, 0, cvs.width, cvs.height);
    y(ctx, cvs, metres, toPx);
  };
}

function y(ctx, cvs, metres, toPx) {
  const gridStep = 50;
  ctx.strokeStyle = '#e5e5e5';
  ctx.lineWidth   = 1;
  for (let x=0; x<=cvs.width; x+=gridStep) {
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,cvs.height); ctx.stroke();
  }
  for (let y=0; y<=cvs.height; y+=gridStep) {
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(cvs.width,y); ctx.stroke();
  }

  ctx.strokeStyle = '#0066cc';
  ctx.lineWidth   = 3;
  ctx.beginPath();
  metres.forEach((p,i)=>{
    const [x,y] = toPx(p);
    i ? ctx.lineTo(x,y) : ctx.moveTo(x,y);
  });
  ctx.stroke();

  // Draw arrowheads
  ctx.fillStyle = '#0066cc';
  for (let i = 0; i < metres.length - 1; i++) {
    const [x1, y1] = toPx(metres[i]);
    const [x2, y2] = toPx(metres[i + 1]);

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;

    const arrowLen = 10;
    const arrowWidth = 6;

    const px = x1 + ux * (len * 0.3);
    const py = y1 + uy * (len * 0.3);

    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - uy * arrowWidth - ux * arrowLen, py + ux * arrowWidth - uy * arrowLen);
    ctx.lineTo(px + uy * arrowWidth - ux * arrowLen, py - ux * arrowWidth - uy * arrowLen);
    ctx.closePath();
    ctx.fill();

    const px2 = x1 + ux * (len * 0.7);
    const py2 = y1 + uy * (len * 0.7);

    ctx.beginPath();
    ctx.moveTo(px2, py2);
    ctx.lineTo(px2 - uy * arrowWidth - ux * arrowLen, py2 + ux * arrowWidth - uy * arrowLen);
    ctx.lineTo(px2 + uy * arrowWidth - ux * arrowLen, py2 - ux * arrowWidth - uy * arrowLen);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = '#d00';
  for (const p of metres) {
    const [x,y] = toPx(p);
    ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fill();
  }

  const botImg = new Image();
  botImg.src   = 'robot.png';                       // drop your sprite here
  botImg.onload = () => {
    const [x0,y0] = toPx(metres[0]);
    const size    = 40;
    ctx.drawImage(botImg, x0-size/2, y0-size/2, size, size);
  };
}

let mediaRecorder = null;
let chunks = [];

speakBtn.addEventListener('click', async () => {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
    } catch (err) {
      alert('Mic access denied');
      return;
    }

    chunks = [];
    mediaRecorder.ondataavailable = e => chunks.push(e.data);
    mediaRecorder.onstop = handleStop;
    mediaRecorder.start();
    speakBtn.textContent = 'Stop recording';
  } else if (mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    speakBtn.textContent = 'Speak command';
  }
});

async function handleStop() {
  const blob = new Blob(chunks, { type: 'audio/webm' });
  const fd = new FormData();
  fd.append('file', blob, 'command.webm');

  showLoading();
  speakBtn.disabled = true;

  try {
    const res = await fetch('/transcribe', { method: 'POST', body: fd });
    if (!res.ok) throw new Errror(await res.text());
    const { xml } = await res.json();
    console.log("Got XML:", xml);

    const parser = new XMLParser.default();
    console.log("parser:", parser);
    const task = parser.parse(xml).TaskTemplate;
    console.log("task:", task);
    x(task);
  } catch (err) {
    console.error(err);
    alert("Failed to process audio command");
  } finally {
    hideLoading();
    speakBtn.disabled = false;
    speakBtn.textContent = 'Speak command';
  }
}

// only as a demo in case the above fails
// fetch("farm.xml")
//   .then(res => res.text())
//   .then(xmlText => {
//     const parser = new XMLParser.default();
//     const task = parser.parse(xmlText).TaskTemplate;

//     x(task);
//   })
//   .catch(err => console.error("Failed to load XML:", err));