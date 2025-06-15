import { useState, useEffect } from 'react';
import {
  StyleSheet, View, Alert, Keyboard, TouchableWithoutFeedback, Platform,
  KeyboardAvoidingView
} from 'react-native';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import MicButton from './components/MicButton';
import PromptField from './components/PromptField';
import OutputArea from './components/OutputArea';

const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;

export default function App() {
  const [inputText, setInputText] = useState('');
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false);

  const record = async () => {
    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();
    setIsRecording(true);
  };

  const stopRecording = async () => {
    await audioRecorder.stop();
    setIsRecording(false);
    setHasRecorded(true);
    setLoading(true);

    const formData = new FormData();
    formData.append('file', {
      uri: audioRecorder.uri,
      name: Platform.OS === 'web' ? 'rec.webm' : 'rec.m4a',
      type: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4',
    } as any);

    try {
      const res = await fetch(BASE_URL + '/voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      const json = await res.json();
      setOutput(json.message);
    } catch (err) {
      setOutput(err instanceof Error ? `Error: ${err.message}` : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Permission to access microphone was denied');
      }
    })();
  }, []);

  async function handleSubmit() {
    Keyboard.dismiss();
    setLoading(true);

    try {
      const res = await fetch(BASE_URL + '/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      });

      const json = await res.json();
      setOutput(json.message);
    } catch (err) {
      setOutput(err instanceof Error ? `Error: ${err.message}` : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.container}>
          <StatusBar style="auto"/>

          <View style={styles.mainContent}>
            {!hasRecorded ? (
              <MicButton
                isRecording={isRecording}
                stopRecording={stopRecording}
                record={record}
                size="large"
              />
            ) : (
              <OutputArea
                output={output}
                loading={loading}
              />
            )}
          </View>

          <View style={[
            styles.bottomControls,
            { paddingBottom: keyboardVisible ? 10 : 20 }
          ]}>
            {hasRecorded && (
              <MicButton
              isRecording={isRecording}
              stopRecording={stopRecording}
              record={record}
              size="small"
              />
            )}

            <PromptField
              inputText={inputText}
              setInputText={setInputText}
              handleSubmit={handleSubmit}
            />
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: '#ecf0f1',
  },

  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#ccc',
  },
});
