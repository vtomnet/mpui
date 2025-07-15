import React, { useState, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faSearch } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NominatimResult } from "../lib/utils";

interface Props {
  onPanTo: (coords: [number, number]) => void;
}

export default function SearchPanel({ onPanTo }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const searchDebounceTimer = useRef<number | null>(null);

  const handleSearchQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (searchDebounceTimer.current) {
      clearTimeout(searchDebounceTimer.current);
    }
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    searchDebounceTimer.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json`)
        setSearchResults(await res.json());
      } catch (err) {
        console.error("Error searching location:", err);
      }
    }, 300);
  };

  const handleResultClick = (r: NominatimResult) => {
    onPanTo([parseFloat(r.lon), parseFloat(r.lat)]);
    setIsOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} className="size-18 p-0">
        <FontAwesomeIcon icon={faSearch} size="xl" />
      </Button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 flex items-center justify-center p-4">
          <div className="bg-background w-full max-w-2xl h-full max-h-[80vh] rounded-lg p-4 flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-4 pb-4 border-b">
              <h2 className="text-xl font-bold">Search Location</h2>
              <Button onClick={() => setIsOpen(false)} variant="ghost" className="size-8 p-0">
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
              {searchResults.map(r => (
                <div
                  key={r.place_id}
                  onClick={() => handleResultClick(r)}
                  className="p-2 hover:bg-muted cursor-pointer rounded"
                >
                  {r.display_name}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
