import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import IconButton from './IconButton';

type PromptFieldProps = {
  inputText: string;
  setInputText: (text: string) => void;
  handleSubmit: () => void;
  placeholder?: string;
};

export default function PromptField({
  inputText,
  setInputText,
  handleSubmit,
  placeholder = "Enter a mission description...",
}: PromptFieldProps) {
  return (
    <View style={styles.inputContainer}>
      <TextInput
        placeholder={placeholder}
        value={inputText}
        onChangeText={setInputText}
        style={styles.textInput}
      />
      <IconButton
        iconName="circle-arrow-up"
        onPress={handleSubmit}
        accessibilityLabel="Submit"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    padding: 10,
    maxHeight: 100,
  },

  textInput: {
    width: '80%',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
  },
});

