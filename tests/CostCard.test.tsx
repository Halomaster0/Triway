// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildEstimate } from "../src/core/estimate";
import { withDefaults } from "../src/shared/storage";
import { CostCard } from "../src/ui/CostCard";

const settings = withDefaults({
  vehicle: { source: "manual", label: "My car", comb: 8 },
  gas: { mode: "manual", manualPrice: 1.5 },
  rider: { age: 17, postSecondary: false, fairPass: false, bramptonResident: false },
});

const estimate = buildEstimate(
  {
    origin: { lat: 43.6453, lng: -79.3806 },
    destination: { lat: 43.5931, lng: -79.6424 },
    driveKm: 27.6,
    driveMinutes: 28,
    hasTolls: true,
    transitLegs: [
      { agency: "TTC", label: "Line 1" },
      { agency: "MiWay", label: "MiWay" },
    ],
    transitMinutes: 57,
  },
  settings,
);

afterEach(cleanup);

describe("CostCard", () => {
  it("shows driving and transit tiles and marks the cheaper one", () => {
    render(<CostCard estimate={estimate} onSettings={() => {}} />);
    const drive = screen.getByTestId("drive");
    const transit = screen.getByTestId("transit");
    expect(drive.textContent).toContain("$3.31");
    expect(transit.textContent).toContain("$2.90");
    expect(transit.textContent).toContain("Youth");
    expect(transit.className).toContain("best");
    expect(transit.textContent).toMatch(/Saves \$0\.41/);
    expect(drive.className).not.toContain("best");
    expect(screen.getByText(/has tolls/)).toBeTruthy();
  });

  it("expands the fare breakdown and opens settings", async () => {
    const onSettings = vi.fn();
    render(<CostCard estimate={estimate} onSettings={onSettings} />);
    await act(async () => fireEvent.click(screen.getByText("Fare breakdown")));
    expect(screen.getByText("One Fare top-up", { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Settings"));
    expect(onSettings).toHaveBeenCalled();
  });

  it("minimises to a pill and back", async () => {
    render(<CostCard estimate={estimate} onSettings={() => {}} />);
    await act(async () => fireEvent.click(screen.getByLabelText("Minimise")));
    const pill = await screen.findByLabelText("Show trip cost");
    expect(pill.textContent).toContain("$3.31");
    await act(async () => fireEvent.click(pill));
    expect(await screen.findByTestId("drive")).toBeTruthy();
  });

  it("offers hide and reset from the menu", async () => {
    const onHide = vi.fn();
    const onOffsetChange = vi.fn();
    render(<CostCard estimate={estimate} onHide={onHide} offset={{ x: -40, y: -10 }} onOffsetChange={onOffsetChange} />);
    fireEvent.click(screen.getByLabelText("More options"));
    fireEvent.click(screen.getByText("Reset position"));
    expect(onOffsetChange).toHaveBeenCalledWith({ x: 0, y: 0 });
    fireEvent.click(screen.getByLabelText("More options"));
    fireEvent.click(screen.getByText("Hide on this route"));
    expect(onHide).toHaveBeenCalled();
  });

  it("shows a loading tile while transit is being checked", () => {
    const e = buildEstimate({ origin: { lat: 43.6453, lng: -79.3806 }, destination: null, driveKm: 10, transitStatus: "pending" }, settings);
    render(<CostCard estimate={e} />);
    expect(screen.getByLabelText("Loading")).toBeTruthy();
  });

  it("has no drag handle controls in preview mode", () => {
    render(<CostCard estimate={estimate} preview />);
    expect(screen.queryByLabelText("More options")).toBeNull();
    expect(screen.queryByLabelText("Minimise")).toBeNull();
  });
});

describe("CostCard with a GO trip", () => {
  it("shows the bus fare, the GO fare, and the refund at the GO tap in order", async () => {
    const e = buildEstimate(
      {
        origin: { lat: 43.5483, lng: -79.6627 },
        destination: { lat: 43.6453, lng: -79.3806 },
        driveKm: 29.2,
        transitLegs: [
          { agency: "MiWay", label: "Bus 110" },
          { agency: "GO", label: "LW" },
        ],
      },
      settings,
    );
    render(<CostCard estimate={e} onSettings={() => {}} />);
    await act(async () => fireEvent.click(screen.getByText("Fare breakdown")));
    const items = Array.from(document.querySelectorAll(".timeline li")).map((li) => li.textContent);
    expect(items[0]).toMatch(/Bus 110.*MiWay.*\$2\.90/);
    expect(items[1]).toMatch(/LW.*GO Transit/);
    expect(items[2]).toMatch(/MiWay fare refunded at GO tap.*−\$2\.90/);
    expect(screen.getByText(/charged \$2\.90 at your first tap/)).toBeTruthy();
  });
});
