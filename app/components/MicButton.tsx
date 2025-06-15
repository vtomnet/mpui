import React from 'react';
import { View, StyleSheet } from 'react-native';
import IconButton from './IconButton';

type MicButtonProps = {
  isRecording: boolean;
  stopRecording: () => void;
  record: () => void;
  size?: 'small' | 'large';
};

export default function MicButton({
  isRecording,
  stopRecording,
  record,
  size = 'large',
}: MicButtonProps) {
  const iconSize = size === 'large' ? 96 : 40;

  return (
    <View style={size === 'large' ? styles.largeContainer : styles.smallContainer}>
      <IconButton
        iconName={isRecording ? 'stop' : 'microphone'}
        onPress={isRecording ? stopRecording : record}
        accessibilityLabel={`${isRecording ? "Stop" : "Start"} recording`}
        iconSize={iconSize}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  largeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  smallContainer: {
    marginRight: 10,
    marginBottom: 10,
  },
});
