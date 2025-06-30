import { useState, useRef, useEffect, FormEvent, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/Spinner";
import PlanPreview, { PlanPreviewActions } from "@/components/PlanPreview";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrophone, faStop, faArrowUp } from '@fortawesome/free-solid-svg-icons';

const SERVER = import.meta.env.VITE_SERVER;

export default function App() {
  const [recording, setRecording] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [text, setText] = useState<string>("");
  const [taskXml, setTaskXml] = useState<string>("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const planPreviewRef = useRef<PlanPreviewActions>(null);
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setInitialCenter([position.coords.longitude, position.coords.latitude]);
      },
      (error) => {
        console.error("Error getting user location:", error);
        // Fallback to a default location if geolocation fails
        setInitialCenter([-120.4202, 37.2664]);
      }
    );
  }, []);

  const handlePath = async (xml: string) => {
    console.log(xml);
    setTaskXml(xml);
  };

  const handleMicClick = async () => {
    if (!recording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = async () => {
          setLoading(true);

          const snapshot = planPreviewRef.current?.takeSnapshot();

          // Note: Safari will send an mp4 and claim it's a webm.
          // Server corrects for this with mime-type detection.
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const formData = new FormData();
          formData.append("file", audioBlob, "recording.webm");
          if (snapshot) {
            formData.append("image", snapshot.image);
            formData.append("northWest", JSON.stringify(snapshot.northWest));
            formData.append("northEast", JSON.stringify(snapshot.northEast));
            formData.append("southWest", JSON.stringify(snapshot.southWest));
            formData.append("southEast", JSON.stringify(snapshot.southEast));
            formData.append("center", JSON.stringify(snapshot.center));
          }

          try {
            const res = await fetch(SERVER + "/api/voice", {
              method: "POST",
              body: formData,
            });

            const data = await res.json();
            console.log(data.result);
            handlePath(data.result);
          } catch (error) {
            console.error(`Error uploading audio: ${error}`);
          } finally {
            setLoading(false);
            mediaStreamRef.current?.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
          }
        };

        mediaRecorderRef.current.start();
        setRecording(true);
      } catch (err) {
        console.error("Microphone access denied or error:", err);
      }
    } else {
      mediaRecorderRef.current?.stop();
      setRecording(false);
    }
  };

  const handleTextSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    const theText = text;

    setLoading(true);
    setText("");

    const snapshot = planPreviewRef.current?.takeSnapshot();

    if (snapshot && snapshot.image) {
      const newTab = window.open();
      if (newTab) {
        newTab.document.body.innerHTML = `<img src="${snapshot.image}" alt="map snapshot" />`;
      } else {
        console.error("Failed to open new tab for snapshot debugging.");
      }
    }

    const res = await fetch(SERVER + "/api/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: theText,
        schemaName: "clearpath_husky",
        // geojsonName: "reza20",
        snapshot: snapshot,
      }),
    });

    const data = await res.json();
    handlePath(data.result);
    setLoading(false);
  };

  const handleTextChange = (e: ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
  };

  return (
    <div className="relative w-screen h-screen">
      <PlanPreview ref={planPreviewRef} xml={taskXml} initialCenter={initialCenter} />
      <div className="fixed bottom-0 left-0 w-screen z-10">
        <div className="w-full p-4 flex justify-end">
          <Button
            onClick={handleMicClick}
            className="size-18 p-0"
            variant={recording ? "destructive" : "default"}
          >
            <FontAwesomeIcon icon={recording ? faStop : faMicrophone} size="xl"/>
          </Button>
        </div>
        <div className="pt-0 px-4 pb-4 w-full">
          <form onSubmit={handleTextSubmit} className="flex items-center gap-3">
            <Input
              type="text"
              value={text}
              onChange={handleTextChange}
              placeholder="Type or speak a mission plan"
              className="text-base h-18 flex-1 focus-visible:ring-0 focus-visible:border-input"
            />
            <Button
              type="submit"
              disabled={text.trim() === "" || loading}
              className="size-18 p-0 disabled:bg-gray-950"
            >
              {loading ? (
                <Spinner variant="secondary" size="lg"/>
              ) : (
              <FontAwesomeIcon icon={faArrowUp} size="xl" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
