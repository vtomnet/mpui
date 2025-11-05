import { useState, useRef, FormEvent, ChangeEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/Spinner";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUp, faMicrophone, faStop, faTimes, faCheck } from "@fortawesome/free-solid-svg-icons";

interface Props {
  onSttResult: (stt: string) => void;
  onFinalResult: (xml: string) => void;
  model: string;
  schemaName: string;
  geojsonName: string;
  setFetchError: (error: string | null) => void;
  initialCenter: [number, number] | null;
  onHeightChange?: (height: number) => void;
}

export default function TextOrMicInput({ onSttResult, onFinalResult, model, schemaName, geojsonName, setFetchError, initialCenter, onHeightChange }: Props) {
  const [mode, setMode] = useState<"buttons" | "typing" | "recording">("buttons");
  const [recording, setRecording] = useState<boolean>(false);
  const [loadingSource, setLoadingSource] = useState<"text" | "mic" | null>(null);
  const loading = loadingSource !== null;
  const [text, setText] = useState<string>("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingCancelledRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure and report height changes
  useEffect(() => {
    const measureHeight = () => {
      if (containerRef.current && onHeightChange) {
        const height = containerRef.current.offsetHeight;
        onHeightChange(height);
      }
    };

    measureHeight();

    // Also measure on window resize
    window.addEventListener('resize', measureHeight);
    return () => window.removeEventListener('resize', measureHeight);
  }, [mode, onHeightChange]); // Re-measure when mode changes

  const handleMicClick = async () => {
    if (!recording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        recordingCancelledRef.current = false; // Reset flag for new recording

        mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = async () => {
          // If recording was cancelled, don't process the audio
          if (recordingCancelledRef.current) {
            recordingCancelledRef.current = false; // Reset flag
            setMode("buttons");
            mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
            return;
          }

          setFetchError(null);
          setLoadingSource("mic");
          onSttResult(""); // Clear previous results

          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const formData = new FormData();
          formData.append("file", audioBlob, "recording.webm");

          const requestData = {
            text: null,
            schema: schemaName,
            model: model,
            ...(geojsonName && { geojsonName }),
            ...(initialCenter && {
              lon: initialCenter[0],
              lat: initialCenter[1]
            })
          };
          formData.append("request", JSON.stringify(requestData));

          try {
            const res = await fetch("/api/generate", {
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
            setMode("buttons");
            mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
          }
        };

        mediaRecorderRef.current.start();
        setRecording(true);
        setMode("recording");
      } catch (err) {
        console.error("Microphone access denied or error:", err);
      }
    } else {
      mediaRecorderRef.current?.stop();
      setRecording(false);
    }
  };

  const handleTextSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return;
    setFetchError(null);
    onSttResult(""); // Clear any previous STT text

    const theText = text;

    setLoadingSource("text");
    setText("");

    const requestData = {
      text: theText,
      schema: schemaName,
      model: model,
      ...(geojsonName && { geojsonName }),
      ...(initialCenter && {
        lon: initialCenter[0],
        lat: initialCenter[1]
      })
    };

    const formData = new FormData();
    formData.append("request", JSON.stringify(requestData));

    try {
      const res = await fetch("/api/generate", {
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
            }
          } catch (e) {
            console.error("Failed to parse JSON from stream:", e);
          }
        }
      }
    } catch (error: any) {
      console.error(`Error submitting text: ${error}`);
      setFetchError(error.message || "An error occurred. Please try again.");
    } finally {
      setLoadingSource(null);
      setMode("buttons");
    }
  };

  const handleTextChange = (e: ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
  };

  const handleTypeClick = () => {
    setMode("typing");
  };

  const handleTalkClick = () => {
    handleMicClick();
  };

  const handleClose = () => {
    setText("");
    setMode("buttons");
  };

  const handleStopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const handleCancelRecording = () => {
    if (mediaRecorderRef.current && recording) {
      recordingCancelledRef.current = true; // Set flag before stopping
      mediaRecorderRef.current.stop();
      setRecording(false);
      // Note: mode and stream cleanup will be handled in the onstop handler when cancelled
    }
  };

  // Main buttons view
  if (mode === "buttons") {
    return (
      <div ref={containerRef} className="w-full flex fixed bottom-0 left-0 right-0 pointer-events-auto">
        <Button
          variant="noglass"
          onClick={handleTypeClick}
          disabled={loading}
          className="flex-1 h-50 rounded-none bg-blue-50 hover:bg-blue-100 text-blue-800 border-r border-gray-200"
        >
          <span className="text-xl font-medium">Type</span>
        </Button>
        <Button
          variant="noglass"
          onClick={handleTalkClick}
          disabled={loading}
          className="flex-1 h-50 rounded-none bg-red-50 hover:bg-red-100 text-red-800"
        >
          {loading && loadingSource === "mic" ? (
            <Spinner variant="secondary" size="lg" />
          ) : (
            <span className="text-xl font-medium">Talk</span>
          )}
        </Button>
      </div>
    );
  }

  // Text input overlay
  if (mode === "typing") {
    return (
      <div ref={containerRef} className="w-full fixed bottom-0 left-0 right-0 pointer-events-auto bg-white border-t border-gray-200">
        <div className="relative h-50 flex items-center">
          <Input
            type="text"
            name="text"
            autoComplete="off"
            value={text}
            onChange={handleTextChange}
            placeholder="Enter a mission plan"
            className="text-base h-full flex-1 border-none rounded-none focus:ring-0 px-4 pr-20"
            style={{ fontSize: "18px" }}
            disabled={loading}
            autoFocus
          />
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-2">
            <Button
              type="button"
              onClick={handleClose}
              disabled={loading}
              variant="ghost"
              className="h-16 w-16 p-0"
            >
              <FontAwesomeIcon icon={faTimes} size="2xl" className="text-black" style={{ fontSize: '1.75rem' }} />
            </Button>
            <Button
              type="button"
              onClick={() => handleTextSubmit()}
              disabled={loading || !text.trim()}
              variant="ghost"
              className="h-16 w-16 p-0"
            >
              {loading && loadingSource === "text" ? (
                <Spinner variant="secondary" size="lg" />
              ) : (
                <FontAwesomeIcon icon={faCheck} size="2xl" className="text-black" style={{ fontSize: '1.75rem' }} />
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Recording overlay
  if (mode === "recording") {
    return (
      <div ref={containerRef} className="w-full fixed bottom-0 left-0 right-0 pointer-events-auto bg-red-50 border-t border-red-200">
        <div className="relative h-50 flex items-center justify-center">
          <Button
            variant="noglass"
            onClick={handleStopRecording}
            disabled={loading}
            className="flex-1 h-full bg-red-100 hover:bg-red-200 text-red-800 rounded-none border-none text-xl font-medium"
          >
            {loading && loadingSource === "mic" ? (
              <div className="flex items-center gap-3">
                <Spinner variant="secondary" size="lg" />
                <span>Processing...</span>
              </div>
            ) : recording ? (
              <div className="flex items-center gap-3">
                <FontAwesomeIcon icon={faStop} size="lg" />
                <span>Tap to stop recording</span>
              </div>
            ) : (
              <span>Ready to submit</span>
            )}
          </Button>
          <Button
            type="button"
            onClick={handleCancelRecording}
            disabled={loading}
            variant="ghost"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-16 w-16 p-0"
          >
            <FontAwesomeIcon icon={faTimes} size="2xl" className="text-black" style={{ fontSize: '1.75rem' }} />
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
