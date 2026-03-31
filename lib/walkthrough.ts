const WALKTHROUGH_KEY = "walkthrough-completed"

export function hasCompletedWalkthrough(): boolean {
  try {
    return localStorage.getItem(WALKTHROUGH_KEY) === "true"
  } catch {
    return true // If localStorage unavailable, skip walkthrough
  }
}

export function markWalkthroughComplete(): void {
  try {
    localStorage.setItem(WALKTHROUGH_KEY, "true")
  } catch {
    // localStorage unavailable
  }
}
