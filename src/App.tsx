import { useState, useRef, useEffect, FormEvent, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/Spinner";
import PlanPreview, { PlanPreviewActions } from "@/components/PlanPreview";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrophone, faStop, faArrowUp, faGear, faSearch, faTimes } from '@fortawesome/free-solid-svg-icons';

const SERVER = "http://localhost:3000";

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
}

export default function App() {
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const searchDebounceTimer = useRef<number | null>(null);
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

  const handleSearchQueryChange = (e: ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (searchDebounceTimer.current) {
      clearTimeout(searchDebounceTimer.current);
    }

    if (query.trim() === "") {
      setSearchResults([]);
      return;
    }

    searchDebounceTimer.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json`);
        const data = await res.json();
        setSearchResults(data);
      } catch (error) {
        console.error("Error searching location:", error);
      }
    }, 300);
  };

  const handleSearchResultClick = (result: NominatimResult) => {
    const lon = parseFloat(result.lon);
    const lat = parseFloat(result.lat);
    planPreviewRef.current?.panTo([lon, lat]);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <div className="relative w-screen h-screen">
      <PlanPreview ref={planPreviewRef} xml={taskXml} initialCenter={initialCenter} />
      <div className="fixed bottom-0 left-0 w-screen z-10">
        <div className="w-full p-4 flex justify-end">
          <div className="flex flex-col gap-4">
            <Button
              onClick={() => setShowSearch(true)}
              className="size-18 p-0"
              variant="secondary"
            >
              <FontAwesomeIcon icon={faSearch} size="xl"/>
            </Button>
            <Button
              onClick={handleMicClick}
              className="size-18 p-0"
              variant={recording ? "destructive" : "default"}
            >
              <FontAwesomeIcon icon={recording ? faStop : faMicrophone} size="xl"/>
            </Button>
          </div>
        </div>
        <div className="pt-0 px-4 pb-4 w-full">
          <form onSubmit={handleTextSubmit} className="flex items-center gap-3">
            <Input
              type="text"
              name="text"
              autoComplete="off"
              value={text}
              onChange={handleTextChange}
              placeholder="Type or speak a mission plan"
              className="text-base h-18 flex-1 focus-visible:ring-0 focus-visible:border-input backdrop-blur-lg border-none placeholder:text-gray-700"
              style={{ fontSize: "18px" }}
            />
            <Button
              type="submit"
              disabled={text.trim() === "" || loading}
              className="size-18 p-0 disabled:bg-gray-950 backdrop-blur-lg"
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
      {showSearch && (
        <div className="fixed inset-0 bg-black/50 z-20 flex items-center justify-center p-4">
          <div className="bg-background w-full max-w-2xl h-full max-h-[80vh] rounded-lg p-4 flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-4 pb-4 border-b">
              <h2 className="text-xl font-bold">Search Location</h2>
              <Button onClick={() => setShowSearch(false)} variant="ghost" className="size-8 p-0">
                <FontAwesomeIcon icon={faTimes} />
              </Button>
            </div>
            <Input
              type="text"
              placeholder="Search for a location..."
              value={searchQuery}
              onChange={handleSearchQueryChange}
              className="mb-4"
              autoFocus
            />
            <div className="flex-1 overflow-y-auto">
              {searchResults.map(result => (
                <div key={result.place_id} onClick={() => handleSearchResultClick(result)} className="p-2 hover:bg-muted cursor-pointer rounded">
                  {result.display_name}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
