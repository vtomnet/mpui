import React from 'react';
import { Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';

type OutputAreaProps = {
  output: string | null;
  loading: boolean;
};

export default function OutputArea({
  output,
  loading,
}: OutputAreaProps) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scrollArea}>
      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <Text selectable>{output}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },

  scrollArea: {
    paddingHorizontal: 10,
  },
});
