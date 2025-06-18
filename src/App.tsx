import { useState, useRef, useEffect, FormEvent, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrophone, faStop, faArrowUp } from '@fortawesome/free-solid-svg-icons';

const SERVER = "http://localhost:3000";

export default function App() {
  const [recording, setRecording] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<any>(null);
  const [text, setText] = useState<string>("");
  const [submitted, setSubmitted] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

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
          setSubmitted(true);
          setLoading(true);

          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const formData = new FormData();
          formData.append("file", audioBlob, "recording.webm");

          try {
            const res = await fetch(SERVER + "/api/voice", {
              method: "POST",
              body: formData,
            });

            const data = await res.json();
            setResponse(data.result);
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

    setLoading(true);
    setSubmitted(true);

    console.log(JSON.stringify({ text }));
    const res = await fetch(SERVER + "/api/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const data = await res.json();
    setResponse(data.result);
    setLoading(false);
    setText("");
  };

  const handleTextChange = (e: ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-muted overflow-hidden select-none" style={{ height: '100dvh' }}>
      <div className="flex-grow flex items-center justify-center select-none">
        { loading ? (
          <Spinner variant="primary" size="lg"/>
        ) : (
          submitted ? (
          <Card className="w-full max-w-xl overflow-auto">
            <CardContent className="p-4 whitespace-pre-wrap text-sm">
              {typeof response === "string" ? response : JSON.stringify(response, null, 2)}
            </CardContent>
          </Card>
          ) : (
          <Button
            onClick={handleMicClick}
            className="rounded-full w-40 h-40 select-none"
            variant={recording ? "destructive" : "default"}
          >
            <div className="w-full h-full flex items-center justify-center select-none">
              <FontAwesomeIcon icon={recording ? faStop : faMicrophone} size="6x" className="size-[10em] select-none"/>
            </div>
          </Button>
          )
        )}
      </div>

      {submitted && (
        <div className="w-full p-4 flex justify-end">
          <Button
            onClick={() => setSubmitted(false)}
            className="h-14 w-14 p-0"
          >
            <div className="w-full h-full flex items-center justify-center">
              <FontAwesomeIcon icon={recording ? faStop : faMicrophone} size="lg"/>
            </div>
          </Button>
        </div>
      )}

      <div className="pt-0 px-4 pb-4 w-full">
        <form onSubmit={handleTextSubmit} className="flex items-center gap-3">
          <Input
            type="text"
            value={text}
            onChange={handleTextChange}
            placeholder="Type or speak a mission plan"
            className="text-base h-14 flex-1"
          />
          { text.trim() !== "" && (
            <Button type="submit" className="h-14 w-14 p-0">
              <FontAwesomeIcon icon={faArrowUp} size="lg"/>
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
