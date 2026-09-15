export type ApplyPlayerCodeResult =
  | { applied: false; saved: false }
  | { applied: true; saved: true }
  | { applied: true; saved: false; error: Error }

/**
 * Activates an editor snapshot before persisting that exact snapshot.
 * A rejected program must never replace the last known-good saved program.
 */
export async function applyAndPersistPlayerCode(
  code: string,
  apply: (code: string) => Promise<boolean>,
  persist: (code: string) => Promise<unknown>,
): Promise<ApplyPlayerCodeResult> {
  const applied = await apply(code)
  if (!applied) return { applied: false, saved: false }

  try {
    await persist(code)
    return { applied: true, saved: true }
  } catch (reason) {
    return {
      applied: true,
      saved: false,
      error: reason instanceof Error ? reason : new Error(String(reason)),
    }
  }
}
