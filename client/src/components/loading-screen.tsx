import { motion } from "framer-motion";

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center overflow-hidden bg-[#1a0a0e] relative">
      {/* Background gradients */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,_#6b1428_0%,_transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_80%_80%,_#3d0a14_0%,_transparent_70%)]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: "200px 200px",
          }}
        />
      </div>

      {/* Pulsing rings */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: [0, 0.15, 0], scale: [0.7, 1.3, 1.3] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut", delay: 0 }}
        className="absolute w-[420px] h-[420px] rounded-full border border-[#c04060]/40"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: [0, 0.1, 0], scale: [0.7, 1.5, 1.5] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
        className="absolute w-[420px] h-[420px] rounded-full border border-[#c04060]/25"
      />

      {/* Static outer ring */}
      <div className="absolute w-[340px] h-[340px] rounded-full border border-[#7a1e30]/20" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <img
            src="/logo-grand-cru-red (1).webp"
            alt="Grand Cru"
            className="w-52 drop-shadow-[0_4px_32px_rgba(180,30,60,0.4)]"
          />
        </motion.div>

        {/* Divider */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
          className="h-px w-24 bg-gradient-to-r from-transparent via-[#c04060]/70 to-transparent"
        />

        {/* Progress bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="w-48 h-0.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
              className="h-full w-1/2 bg-gradient-to-r from-transparent via-[#c04060] to-transparent rounded-full"
            />
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.8 }}
            className="text-[#c04060]/60 text-xs tracking-[0.2em] uppercase font-light"
          >
            Carregando
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
