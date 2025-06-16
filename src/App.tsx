import { useState, useEffect } from 'react';

const App = () => {
  const [count, setCount] = useState(0);
  const [proverb, setProverb] = useState("");

  useEffect(() => {
    fetch('/api/proverb')
      .then(res => res.json())
      .then(data => setProverb(data.message))
      .catch(err => {
        console.error("Failed to fetch proverb:", err);
        setProverb("Could not load proverb");
      });
  }, []);

  return (
    <>
      <button onClick={() => setCount(count + 1)}>Count: {count}</button>
      <p>{proverb}</p>
    </>
  );
};

export default App;
