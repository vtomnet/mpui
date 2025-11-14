export interface ContextFilesResponse {
  files: string[];
}

export async function fetchContextFiles(): Promise<string[]> {
  try {
    const response = await fetch('/api/context_files');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data: ContextFilesResponse = await response.json();
    return data.files;
  } catch (error) {
    console.error('Error fetching context files:', error);
    return [];
  }
}