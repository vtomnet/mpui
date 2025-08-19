import { useState, useRef, FormEvent, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/Spinner";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUp, faMicrophone, faStop } from "@fortawesome/free-solid-svg-icons";

interface Props {
  onSttResult: (stt: string) => void;
  onFinalResult: (xml: string) => void;
  model: string;
  schemaName: string;
  geojsonName: string;
  setFetchError: (error: string | null) => void;
  initialCenter: [number, number] | null;
}

export default function TextOrMicInput({ onSttResult, onFinalResult, model, schemaName, geojsonName, setFetchError, initialCenter }: Props) {
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
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = async () => {
          setFetchError(null);
          setLoadingSource("mic");
          onSttResult(""); // Clear previous results

          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const formData = new FormData();
          formData.append("file", audioBlob, "recording.webm");
          formData.append("schemaName", schemaName);
          formData.append("model", model);
          if (geojsonName) {
            formData.append("geojsonName", geojsonName);
          }
          if (initialCenter) {
            formData.append("lon", String(initialCenter[0]));
            formData.append("lat", String(initialCenter[1]));
          }

          try {
            const res = await fetch("/api/voice", {
              method: "POST",
              body: formData,
            });

            if (!res.body) throw new Error("Response body is null");

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              console.log(`buffer: ${buffer}`);
              const lines = buffer.split('\n');
              buffer = lines.pop() || ""; // Keep incomplete line in buffer

              for (const line of lines) {
                if (line.trim() === "") continue;
                try {
                  const data = JSON.parse(line);
                  if (data.stt) onSttResult(data.stt);
                  if (data.result) onFinalResult(data.result);
                  if (data.error) {
                      console.error("Server-side error:", data.error);
                      setFetchError(data.error);
                      onSttResult(`Error: ${data.error}`);
                  }
                } catch (e) {
                    console.error("Failed to parse JSON from stream:", e)
                }
              }
            }

          } catch (error: any) {
            console.error(`Error uploading audio: ${error}`);
            const message = "An error occurred during voice processing. Please try again.";
            setFetchError(message);
            onSttResult(message);
          } finally {
            setLoadingSource(null);
            mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
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
    setFetchError(null);
    onSttResult(""); // Clear any previous STT text

    const theText = text;

    setLoadingSource("text");
    setText("");

    const payload = {
      text: theText,
      schemaName: schemaName,
      geojsonName: geojsonName || undefined,
      model,
      lon: initialCenter?.[0],
      lat: initialCenter?.[1],
    };

    try {
      const res = await fetch("/api/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `HTTP error! status: ${res.status}`);
      }

      onFinalResult(data.result);
    } catch (error: any) {
      console.error(`Error submitting text: ${error}`);
      setFetchError(error.message || "An error occurred. Please try again.");
    } finally {
      setLoadingSource(null);
    }
  };

  const handleTextChange = (e: ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
  };

  const hasText = text.trim() !== "";

  return (
    <div className="pt-0 pl-6 pr-4 pb-4 w-full flex items-center gap-3 pointer-events-auto">
      <form onSubmit={handleTextSubmit} className="relative flex-1 flex items-center gap-3">
        <Input
          type="text"
          name="text"
          autoComplete="off"
          value={text}
          onChange={handleTextChange}
          placeholder="Enter a mission plan"
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
