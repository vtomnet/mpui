import { useState, useRef, FormEvent, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/Spinner";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUp, faMicrophone, faStop } from "@fortawesome/free-solid-svg-icons";

interface Props {
  onResult: (xml: string) => void;
  model: string;
  geojsonName: string;
}

export default function TextOrMicInput({ onResult, model, geojsonName }: Props) {
  const [recording, setRecording] = useState<boolean>(false);
  const [loadingSource, setLoadingSource] = useState<"text" | "mic" | null>(null);
  const loading = loadingSource !== null;
  const [text, setText] = useState<string>("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleMicClick = async () => {
    if (!recording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        mediaStreamRef.current = stream;
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = async () => {
          setLoadingSource("mic");

          // Note: Safari will send an mp4 and claim it's a webm.
          // Server corrects for this with mime-type detection.
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/webm",
          });
          const formData = new FormData();
          formData.append("file", audioBlob, "recording.webm");
          formData.append("schemaName", "clearpath_husky");
          formData.append("model", model);
          if (geojsonName) {
            formData.append("geojsonName", geojsonName);
          }

          try {
            const res = await fetch("/api/voice", {
              method: "POST",
              body: formData,
            });

            const data = await res.json();
            console.log(data.result);
            onResult(data.result);
          } catch (error) {
            console.error(`Error uploading audio: ${error}`);
          } finally {
            setLoadingSource(null);
            mediaStreamRef.current
              ?.getTracks()
              .forEach((track) => track.stop());
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

    setLoadingSource("text");
    setText("");

    try {
      const res = await fetch("/api/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: theText,
          schemaName: "clearpath_husky",
          geojsonName: geojsonName || undefined,
          model,
        }),
      });

      const data = await res.json();
      onResult(data.result);
    } catch (error) {
      console.error(`Error submitting text: ${error}`);
    } finally {
      setLoadingSource(null);
    }
  };

  const handleTextChange = (e: ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
  };

  const hasText = text.trim() !== "";

  return (
    <div className="pt-0 px-4 pb-4 w-full flex items-center gap-3 pointer-events-auto">
      <form onSubmit={handleTextSubmit} className="relative flex-1 flex items-center gap-3">
        <Input
          type="text"
          name="text"
          autoComplete="off"
          value={text}
          onChange={handleTextChange}
          placeholder="Type or speak a mission plan"
          className="text-base h-20 flex-1 placeholder:text-gray-50 pr-12 glass"
          style={{ fontSize: "18px" }}
          disabled={loading}
        />
        <Button
          type={hasText ? "submit" : "button"}
          onClick={!hasText ? handleMicClick : undefined}
          disabled={loading}
          variant={recording ? "destructive" : "ghost"}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 size-16 bg-none"
        >
          {loading ? (
            <Spinner variant="secondary" size="lg" />
          ) : recording ? (
            <FontAwesomeIcon icon={faStop} size="2xl" />
          ) : hasText ? (
            <FontAwesomeIcon icon={faArrowUp} size="2xl" />
          ) : (
            <FontAwesomeIcon icon={faMicrophone} size="2xl" />
          )}
        </Button>
      </form>
    </div>
  );
}
