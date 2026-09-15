export type User = { id: string; name: string; email: string; createdAt: string }
export type Notebook = { id: string; title: string; version: number; createdAt: string; updatedAt: string }
export type NoteSummary = { id: string; title: string; version: number; updatedAt: string }
export type NotebookDetail = Notebook & { notes: NoteSummary[] }
export type Note = { id: string; notebookId: string; title: string; content: string; version: number; createdAt: string; updatedAt: string }
export type PublicNote = Pick<Note, 'title' | 'content' | 'updatedAt'>
export type ApiError = { code: string; message: string; fields?: Record<string, string>; status?: number }
