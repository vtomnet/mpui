import { useState, useRef, useEffect, FormEvent, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/Spinner";
import PlanPreview, { PlanPreviewActions } from "@/components/PlanPreview";
import SearchPanel from "@/components/SearchPanel";
import SettingsPanel from "@/components/SettingsPanel";
import TextInput from "@/components/TextInput";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrophone, faStop, faArrowUp } from '@fortawesome/free-solid-svg-icons';

export default function App() {
  const [realtimeHighlighting, setRealtimeHighlighting] = useState<boolean>(true);
  const [showCachedPolygons, setShowCachedPolygons] = useState<boolean>(false);

  const [recording, setRecording] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [text, setText] = useState<string>("");
  const [taskXml, setTaskXml] = useState<string>("");
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);

  const planPreviewRef = useRef<PlanPreviewActions>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (p) => setInitialCenter([p.coords.longitude, p.coords.latitude]),
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

          // Note: Safari will send an mp4 and claim it's a webm.
          // Server corrects for this with mime-type detection.
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const formData = new FormData();
          formData.append("file", audioBlob, "recording.webm");

          try {
            const res = await fetch("/api/voice", {
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

    const res = await fetch("/api/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: theText,
        schemaName: "clearpath_husky",
        // geojsonName: "reza20",
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
      <PlanPreview
        ref={planPreviewRef}
        xml={taskXml}
        initialCenter={initialCenter}
        realtimeHighlighting={realtimeHighlighting}
        showCachedPolygons={showCachedPolygons}
      />

      <SettingsPanel
        realtimeHighlighting={realtimeHighlighting}
        setRealtimeHighlighting={setRealtimeHighlighting}
        showCachedPolygons={showCachedPolygons}
        setShowCachedPolygons={setShowCachedPolygons}
      />

      <div className="fixed bottom-0 left-0 w-screen z-10 pointer-events-none">
        <div className="w-full p-4 flex justify-end">
          <div className="flex flex-col gap-4 pointer-events-auto">
            <SearchPanel onPanTo={coords => planPreviewRef.current?.panTo(coords)}/>

            <Button
              onClick={handleMicClick}
              className="size-18 p-0"
              variant={recording ? "destructive" : "default"}
            >
              <FontAwesomeIcon icon={recording ? faStop : faMicrophone} size="xl"/>
            </Button>
          </div>
        </div>

        <TextInput
          text={text}
          loading={loading}
          onChange={handleTextChange}
          onSubmit={handleTextSubmit}
        />
      </div>
    </div>
  );
}
