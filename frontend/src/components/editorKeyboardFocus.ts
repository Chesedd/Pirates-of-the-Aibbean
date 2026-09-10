type Disposable = { dispose(): void }

export type FocusAwareEditor = {
  hasTextFocus(): boolean
  hasWidgetFocus(): boolean
  onDidFocusEditorText(listener: () => void): Disposable
  onDidBlurEditorText(listener: () => void): Disposable
  onDidFocusEditorWidget(listener: () => void): Disposable
  onDidBlurEditorWidget(listener: () => void): Disposable
}

/** Keeps game input disabled for both Monaco's text area and its auxiliary widgets. */
export function bindEditorKeyboardFocus(
  editor: FocusAwareEditor,
  onChange: (focused: boolean) => void,
): Disposable {
  const focused = () => onChange(true)
  const blurred = () => queueMicrotask(() => {
    onChange(editor.hasTextFocus() || editor.hasWidgetFocus())
  })
  const subscriptions = [
    editor.onDidFocusEditorText(focused),
    editor.onDidBlurEditorText(blurred),
    editor.onDidFocusEditorWidget(focused),
    editor.onDidBlurEditorWidget(blurred),
  ]
  return { dispose: () => subscriptions.forEach((subscription) => subscription.dispose()) }
}
