import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

describe("Popup App", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.mocked(chrome.sidePanel.open).mockClear();
    vi.mocked(chrome.runtime.openOptionsPage).mockClear();
  });

  it("renders main actions", () => {
    render(<App />);
    expect(screen.getByText("Link Hints")).toBeInTheDocument();
    expect(screen.getByText("Resources")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("opens side panel when Resources is clicked", async () => {
    render(<App />);
    await user.click(screen.getByText("Resources"));
    expect(chrome.sidePanel.open).toHaveBeenCalled();
  });

  it("opens options page when Settings is clicked", async () => {
    render(<App />);
    await user.click(screen.getByText("Settings"));
    expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
  });
});
