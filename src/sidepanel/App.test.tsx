import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import * as resourceStorage from "@/content/utils/resource-storage";

const mockResources = [
  {
    id: "r1",
    url: "https://example.com/page",
    title: "Example Page",
    notes: "",
    tags: ["demo"],
    createdAt: Date.now() - 3600000,
    pageUrl: "https://example.com",
    pageTitle: "Example",
    linkContext: undefined,
  },
];

vi.mock("@/content/utils/resource-storage", () => ({
  getAllResources: vi.fn(),
  deleteResource: vi.fn(),
  deleteAllResources: vi.fn(),
  updateResourceTags: vi.fn(),
  updateResourceNotes: vi.fn(),
  searchResources: vi.fn(),
  getVaultStats: vi.fn().mockResolvedValue({ count: 0 }),
  addDocument: vi.fn(),
  importVaultLines: vi.fn(),
  formatResourceDate: (ts: number) => (ts ? "1h ago" : ""),
  getResourcePreviewText: (r: { notes?: string; text?: string; url: string }) =>
    r.notes || r.text || r.url,
}));

describe("Sidepanel App", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(async () => {
    user = userEvent.setup();
    Element.prototype.scrollIntoView = vi.fn();
    vi.mocked(resourceStorage.getAllResources).mockResolvedValue([]);
    vi.mocked(resourceStorage.searchResources).mockResolvedValue([]);
    vi.mocked(resourceStorage.deleteResource).mockClear().mockResolvedValue();
    vi.mocked(resourceStorage.deleteAllResources).mockClear().mockResolvedValue();
    vi.mocked(resourceStorage.updateResourceTags).mockResolvedValue(null);
    vi.mocked(resourceStorage.updateResourceNotes).mockResolvedValue(null);
    vi.mocked(chrome.runtime.connect).mockReturnValue({
      postMessage: vi.fn(),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      onDisconnect: { addListener: vi.fn(), removeListener: vi.fn() },
      disconnect: vi.fn(),
      name: "sidePanel",
    } as unknown as chrome.runtime.Port);
  });

  afterEach(() => {
    document.querySelectorAll(".modal-overlay").forEach((el) => el.remove());
  });

  it("renders tab navigation with Resources, AI Assistant, and Ask", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /resources/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ai assistant/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ask/i })).toBeInTheDocument();
  });

  it("shows Resources panel by default with RESOURCES header and search", () => {
    render(<App />);
    expect(screen.getByText("RESOURCES")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Filter resources...")).toBeInTheDocument();
  });

  it("shows loading then empty state when no resources", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("No resources found")).toBeInTheDocument();
    });
    expect(screen.getByText(/Use Ctrl\+Shift\+L to capture links/)).toBeInTheDocument();
  });

  it("shows resource list when resources are loaded", async () => {
    vi.mocked(resourceStorage.getAllResources).mockResolvedValue(mockResources);
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Example Page")).toBeInTheDocument();
    });
    expect(screen.getByText("https://example.com/page")).toBeInTheDocument();
    expect(screen.getByText("#demo")).toBeInTheDocument();
  });

  it("shows Clear vault when resources exist", async () => {
    vi.mocked(resourceStorage.getAllResources).mockResolvedValue(mockResources);
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Example Page")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Clear vault" })).toBeInTheDocument();
  });

  it("switches to AI Assistant tab when clicked", async () => {
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ai assistant/i }));
    expect(screen.getByRole("button", { name: /ai assistant/i })).toHaveClass("active");
    expect(screen.queryByPlaceholderText("Filter resources...")).not.toBeInTheDocument();
  });

  it("switches to Ask tab when clicked", async () => {
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ask/i }));
    expect(screen.getByRole("button", { name: /ask/i })).toHaveClass("active");
  });

  it("opens edit modal when EDIT is clicked on a resource", async () => {
    vi.mocked(resourceStorage.getAllResources).mockResolvedValue(mockResources);
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Example Page")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "EDIT" }));
    expect(screen.getByText("Edit Resource")).toBeInTheDocument();
    expect(screen.getByDisplayValue("demo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("closes edit modal when Cancel is clicked", async () => {
    vi.mocked(resourceStorage.getAllResources).mockResolvedValue(mockResources);
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Example Page")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "EDIT" }));
    expect(screen.getByText("Edit Resource")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Edit Resource")).not.toBeInTheDocument();
  });

  it("saves edit when Save is clicked and closes modal", async () => {
    vi.mocked(resourceStorage.getAllResources).mockResolvedValue(mockResources);
    vi.mocked(resourceStorage.updateResourceTags).mockResolvedValue(null);
    vi.mocked(resourceStorage.updateResourceNotes).mockResolvedValue(null);
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Example Page")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "EDIT" }));
    await user.clear(screen.getByDisplayValue("demo"));
    await user.type(screen.getByPlaceholderText("tag1, tag2, tag3"), "newtag");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(resourceStorage.updateResourceTags).toHaveBeenCalledWith("r1", ["newtag"]);
      expect(resourceStorage.updateResourceNotes).toHaveBeenCalledWith("r1", "");
    });
    expect(screen.queryByText("Edit Resource")).not.toBeInTheDocument();
  });

  it("shows Resources tab as active by default", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /resources/i })).toHaveClass("active");
  });

  it("opens delete confirmation when DELETE is clicked", async () => {
    vi.mocked(resourceStorage.getAllResources).mockResolvedValue(mockResources);
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Example Page")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "DELETE" }));
    expect(screen.getByText("Delete Resource")).toBeInTheDocument();
    expect(screen.getByText("Are you sure you want to delete this resource?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("deletes resource when Delete is confirmed in overlay", async () => {
    vi.mocked(resourceStorage.getAllResources).mockResolvedValue(mockResources);
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Example Page")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "DELETE" }));
    const deleteBtn = await screen.findByRole("button", { name: "Delete" });
    await user.click(deleteBtn);
    await waitFor(() => {
      expect(resourceStorage.deleteResource).toHaveBeenCalledWith("r1");
    });
  });

  it("cancels delete when Cancel is clicked in delete overlay", async () => {
    vi.mocked(resourceStorage.getAllResources).mockResolvedValue(mockResources);
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Example Page")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "DELETE" }));
    const cancelBtn = await screen.findByRole("button", { name: "Cancel" });
    await user.click(cancelBtn);
    expect(resourceStorage.deleteResource).not.toHaveBeenCalled();
  });

  it("opens delete-all confirmation when Clear vault is clicked", async () => {
    vi.mocked(resourceStorage.getAllResources).mockResolvedValue(mockResources);
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Example Page")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Clear vault" }));
    expect(
      screen.getByText(/Are you sure you want to delete all resources\?/),
    ).toBeInTheDocument();
    const clearVaultButtons = screen.getAllByRole("button", { name: "Clear vault" });
    expect(clearVaultButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("deletes all resources when Clear vault is confirmed", async () => {
    vi.mocked(resourceStorage.getAllResources).mockResolvedValue(mockResources);
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Example Page")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Clear vault" }));
    const clearVaultButtons = await screen.findAllByRole("button", { name: "Clear vault" });
    await user.click(clearVaultButtons[clearVaultButtons.length - 1]);
    await waitFor(() => {
      expect(resourceStorage.deleteAllResources).toHaveBeenCalled();
    });
  });

  it("cancels delete all when Cancel is clicked in overlay", async () => {
    vi.mocked(resourceStorage.getAllResources).mockResolvedValue(mockResources);
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Example Page")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Clear vault" }));
    const cancelButtons = screen.getAllByRole("button", { name: "Cancel" });
    await user.click(cancelButtons[cancelButtons.length - 1]);
    expect(resourceStorage.deleteAllResources).not.toHaveBeenCalled();
  });

  it("filters resources when typing in search", async () => {
    vi.mocked(resourceStorage.getAllResources).mockResolvedValue(mockResources);
    vi.mocked(resourceStorage.searchResources).mockResolvedValue([]);
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Example Page")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("Filter resources..."), "react");
    await waitFor(
      () => {
        expect(resourceStorage.searchResources).toHaveBeenCalledWith("react");
      },
      { timeout: 1000 },
    );
  });

  it("reloads resources when query is cleared", async () => {
    vi.mocked(resourceStorage.getAllResources).mockResolvedValue(mockResources);
    vi.mocked(resourceStorage.searchResources).mockResolvedValue([]);
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Example Page")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("Filter resources..."), "x");
    await waitFor(
      () => {
        expect(resourceStorage.searchResources).toHaveBeenCalledWith("x");
      },
      { timeout: 1000 },
    );
    await user.clear(screen.getByPlaceholderText("Filter resources..."));
    await waitFor(
      () => {
        expect(resourceStorage.getAllResources).toHaveBeenCalled();
      },
      { timeout: 1000 },
    );
  });

  it("opens resource URL in new tab when title is clicked", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    vi.mocked(resourceStorage.getAllResources).mockResolvedValue(mockResources);
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Example Page")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Example Page"));
    expect(openSpy).toHaveBeenCalledWith("https://example.com/page", "_blank");
    openSpy.mockRestore();
  });

  it("reloads resources when RESOURCES_UPDATED message is received", async () => {
    vi.mocked(resourceStorage.getAllResources).mockResolvedValue([]);
    render(<App />);
    await waitFor(() => {
      expect(resourceStorage.getAllResources).toHaveBeenCalled();
    });
    const callCount = vi.mocked(resourceStorage.getAllResources).mock.calls.length;
    const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0]?.[0] as
      | ((msg: unknown) => void)
      | undefined;
    expect(listener).toBeDefined();
    listener!({ type: "RESOURCES_UPDATED" });
    await waitFor(
      () => {
        expect(resourceStorage.getAllResources).toHaveBeenCalledTimes(callCount + 1);
      },
      { timeout: 1000 },
    );
  });
});
