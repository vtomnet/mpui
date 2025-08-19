import React, { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { Input } from "@/components/ui/input";
import { GooglePlace } from "../lib/utils";
import Panel from "./Panel";

interface Props {
  onPanTo: (coords: [number, number]) => void;
}

export default function SearchPanel({ onPanTo }: Props) {
  const places = useMapsLibrary("places");
  const [searchQuery, setSearchQuery] = useState("");
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [searchHistory, setSearchHistory] = useState<GooglePlace[]>(() => {
    const saved = localStorage.getItem("searchHistory");
    if (saved) {
      try {
        const history = JSON.parse(saved) as GooglePlace[];
        return history.filter(item => item && item.id && item.name);
      } catch (e) {
        console.error("Failed to parse search history:", e);
        return [];
      }
    }
    return [];
  });
  const [autocompleteService, setAutocompleteService] = useState<google.maps.places.AutocompleteService | null>(null);
  const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null);
  const searchDebounceTimer = useRef<number | null>(null);

  useEffect(() => {
    if (places) {
      setAutocompleteService(new places.AutocompleteService());
      setPlacesService(new places.PlacesService(document.createElement("div")));
    }
  }, [places]);

  const handleSearchQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (searchDebounceTimer.current) {
      clearTimeout(searchDebounceTimer.current);
    }
    if (!query.trim() || !autocompleteService) {
      setPredictions([]);
      return;
    }

    searchDebounceTimer.current = window.setTimeout(() => {
      autocompleteService.getPlacePredictions({ input: query }, (results) => {
        setPredictions(results || []);
      });
    }, 300);
  };

  const handlePredictionClick = (prediction: google.maps.places.AutocompletePrediction, close: () => void) => {
    if (!placesService || !prediction.place_id) return;

    placesService.getDetails({ placeId: prediction.place_id, fields: ["geometry.location", "name", "place_id"] }, (place, status) => {
      if (status === "OK" && place?.geometry?.location && place.place_id && place.name) {
        const newPlace: GooglePlace = {
          id: place.place_id,
          name: place.name,
          location: {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          },
        };
        handleResultClick(newPlace, close);
      }
    });
  };

  const handleResultClick = (r: GooglePlace, close: () => void) => {
    onPanTo([r.location.lng, r.location.lat]);
    const newHistory = [
      r,
      ...searchHistory.filter((item) => item.id !== r.id),
    ];
    setSearchHistory(newHistory);
    localStorage.setItem("searchHistory", JSON.stringify(newHistory));
    setSearchQuery("");
    setPredictions([]);
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
            {(searchQuery.trim() ? predictions : searchHistory).map((item) => {
              const isPrediction = 'place_id' in item;
              const key = isPrediction ? item.place_id : item.id;
              const displayName = isPrediction ? item.description : item.name;

              return (
                <div
                  key={key}
                  onClick={() => isPrediction ? handlePredictionClick(item, close) : handleResultClick(item, close)}
                  className="p-2 hover:bg-muted cursor-pointer rounded"
                >
                  {displayName}
                </div>
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );
}
