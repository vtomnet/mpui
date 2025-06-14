// import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View, TextInput, Button, Text, ScrollView, ActivityIndicator } from 'react-native';


export default function App() {
  const [inputText, setInputText] = useState('');
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);

    try {
      const res = await fetch('http://10.35.20.13:3000/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      });

      const json = await res.json();
      setOutput(json.message);
    } catch (err) {
      setOutput(`Error: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
      <TextInput
        placeholder="Enter text"
        value={inputText}
        onChangeText={setInputText}
        style={styles.container}
      />
      <Button title="Submit" onPress={handleSubmit}/>
      <View style={{ marginTop: 24 }}>
        {loading ? (
          <ActivityIndicator size="large"/>
        ) : (
          <Text selectable>{output}</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    marginBottom: 16
  }
})