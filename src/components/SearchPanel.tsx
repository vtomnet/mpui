import React, { useState, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { Input } from "@/components/ui/input";
import { NominatimResult } from "../lib/utils";
import Panel from "./Panel";

interface Props {
  onPanTo: (coords: [number, number]) => void;
}

export default function SearchPanel({ onPanTo }: Props) {
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

  const handleResultClick = (r: NominatimResult, close: () => void) => {
    onPanTo([parseFloat(r.lon), parseFloat(r.lat)]);
    setSearchQuery("");
    setSearchResults([]);
    close();
  };

  return (
    <Panel
      title="Search Location"
      trigger={<FontAwesomeIcon icon={faSearch} size="2xl" />}
    >
      {(close) => (
        <>
          <Input
            type="text"
            placeholder="Search for a location..."
            value={searchQuery}
            onChange={handleSearchQueryChange}
            className="mb-4"
            autoFocus
          />

          <div className="flex-1 overflow-y-auto">
            {searchResults.map((r) => (
              <div
                key={r.place_id}
                onClick={() => handleResultClick(r, close)}
                className="p-2 hover:bg-muted cursor-pointer rounded"
              >
                {r.display_name}
              </div>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}
