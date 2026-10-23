import { AnimatePresence, motion } from "motion/react";
import { RELEASES_PAGE, type UpdateInfo } from "../shared/live";
import { InfoIcon } from "./icons";

/** Unpacked installs don't auto-update, so say when a newer release exists. */
export function UpdateBanner({ update }: { update: UpdateInfo | null }) {
  return (
    <AnimatePresence>
      {update?.version && (
        <motion.div
          className="info update"
          role="status"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <InfoIcon size={16} />
          <span>
            Triway {update.version} is available.{" "}
            <a href={update.url || RELEASES_PAGE} target="_blank" rel="noreferrer">
              Download and update →
            </a>
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
