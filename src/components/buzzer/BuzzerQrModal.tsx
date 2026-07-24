"use client";

import { QRCodeSVG } from "qrcode.react";
import { AnimatePresence, motion } from "framer-motion";

interface BuzzerQrModalProps {
  open: boolean;
  onClose: () => void;
  roomCode: string;
  buzzUrl: string;
  isConnected: boolean;
  isConfigured: boolean;
}

export default function BuzzerQrModal({
  open,
  onClose,
  roomCode,
  buzzUrl,
  isConnected,
  isConfigured,
}: BuzzerQrModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="buzzer-qr"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-md rounded-2xl bg-jeopardy-blue-dark p-6 text-center ring-2 ring-jeopardy-gold/40"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-jeopardy-gold">
              Mobile Buzzers
            </h2>
            <p className="mt-2 text-sm text-white/70">
              Scan to join room{" "}
              <span className="font-bold text-jeopardy-gold">{roomCode}</span>
            </p>

            {!isConfigured ? (
              <p className="mt-6 rounded-lg bg-red-900/40 px-4 py-3 text-sm text-red-200">
                Add <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                <code className="text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to
                enable realtime buzzers.
              </p>
            ) : (
              <>
                <div className="mx-auto mt-6 inline-block rounded-xl bg-white p-4">
                  <QRCodeSVG value={buzzUrl} size={220} level="M" />
                </div>
                <p className="mt-4 break-all text-xs text-white/50">{buzzUrl}</p>
                <p
                  className={`mt-3 text-sm font-bold ${
                    isConnected ? "text-green-400" : "text-yellow-300"
                  }`}
                >
                  {isConnected ? "Realtime channel LIVE" : "Connecting…"}
                </p>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="mt-6 rounded-lg bg-jeopardy-gold px-8 py-2.5 text-sm font-bold text-jeopardy-blue-dark transition hover:bg-yellow-300"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
