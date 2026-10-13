/*
 * CommandPaletteHost — renders the global command palette backed by the
 * zustand UI store and wires up Cmd/Ctrl+K to toggle it.
 *
 * M1 ships a "coming soon" command list — navigation links to the routes
 * we know about plus placeholder theme/language toggles. Each feature can
 * register its own commands later via a small registry in this file, but
 * for now we hard-code the minimum set so the palette demonstrates intent
 * without fanning out a command-registration dependency.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Command, type CommandItem } from "../primitives";
import { listMatchesForPatient, listPatientsWithMatches, listTrials } from "../../data/mockApi";
import { useImportedTrialsStore } from "../../stores/importedTrials";
import { useUiStore } from "../../stores/ui";

export function CommandPaletteHost() {
  const navigate = useNavigate();
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const setTheme = useUiStore((s) => s.setTheme);
  const currentTheme = useUiStore((s) => s.theme);
  useImportedTrialsStore((s) => s.updatedAt);

  // Cmd/Ctrl+K toggles the palette from anywhere in the app.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        useUiStore.getState().toggleCommandPalette();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const adminCommands = listTrials().slice(0, 3).map((trial) => ({
    id: `nav-admin-${trial.id}`,
    label: `Open Trial Admin: ${trial.label}`,
    group: "Navigate",
    keywords: ["protocol", "version", "trial", "admin"],
    onRun: () => navigate(`/admin/trials/${trial.id}`),
  }));
  const auditCommands = listPatientsWithMatches()
    .slice(0, 3)
    .map((patient) => listMatchesForPatient(patient.id)[0])
    .filter((match): match is NonNullable<typeof match> => Boolean(match))
    .map((match) => ({
      id: `nav-audit-${match.matchId}`,
      label: `Open Audit: ${match.patientLabel.split(" | ")[0]} / ${match.trialLabel.split(" | ")[0]}`,
      group: "Navigate",
      keywords: ["history", "decision", "audit", "patient", "trial"],
      onRun: () => navigate(`/audit/${match.matchId}`),
    }));

  const commands: CommandItem[] = [
    {
      id: "nav-cockpit",
      label: "Go to Cockpit",
      group: "Navigate",
      keywords: ["queue", "today", "task"],
      onRun: () => navigate("/cockpit"),
    },
    {
      id: "nav-command-center",
      label: "Go to Command Center",
      group: "Navigate",
      keywords: ["ops", "portfolio"],
      onRun: () => navigate("/command-center"),
    },
    ...adminCommands,
    ...auditCommands,
    {
      id: "theme-light",
      label: "Theme: Light",
      group: "Appearance",
      disabled: currentTheme === "light",
      onRun: () => setTheme("light"),
    },
    {
      id: "theme-dark",
      label: "Theme: Dark",
      group: "Appearance",
      disabled: currentTheme === "dark",
      onRun: () => setTheme("dark"),
    },
    {
      id: "theme-hc",
      label: "Theme: High Contrast",
      group: "Appearance",
      disabled: currentTheme === "hc",
      onRun: () => setTheme("hc"),
    },
  ];

  return (
    <Command
      open={open}
      onOpenChange={setOpen}
      commands={commands}
      placeholder="Search actions and pages…"
      title="Command palette"
    />
  );
}
