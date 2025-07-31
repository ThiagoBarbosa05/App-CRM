import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BirthdayCakeAnimationProps {
  clientName: string;
  show: boolean;
  onClose: () => void;
}

export default function BirthdayCakeAnimation({ clientName, show, onClose }: BirthdayCakeAnimationProps) {
  const [showFireworks, setShowFireworks] = useState(false);

  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        setShowFireworks(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [show]);

  const cakeVariants = {
    hidden: { scale: 0, rotate: -180, opacity: 0 },
    visible: { 
      scale: 1, 
      rotate: 0, 
      opacity: 1,
      transition: {
        type: "spring",
        damping: 15,
        stiffness: 300,
        duration: 1.2
      }
    },
    exit: { 
      scale: 0, 
      rotate: 180, 
      opacity: 0,
      transition: { duration: 0.5 }
    }
  };

  const candleFlameVariants = {
    flame: {
      scale: [1, 1.2, 1],
      opacity: [1, 0.8, 1],
      transition: {
        duration: 0.8,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  const fireworkVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: {
      scale: [0, 1.5, 1],
      opacity: [0, 1, 0],
      transition: {
        duration: 1.5,
        ease: "easeOut"
      }
    }
  };

  const confettiColors = ["#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#feca57", "#ff9ff3", "#54a0ff"];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={onClose}
        >
          <motion.div
            variants={cakeVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative bg-white rounded-3xl p-8 max-w-md mx-4 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-8 w-8 p-0"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Birthday message */}
            <motion.h2 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-2xl font-bold text-wine-600 mb-2"
            >
              🎉 Parabéns! 🎉
            </motion.h2>
            
            <motion.p 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-lg text-gray-700 mb-6"
            >
              Hoje é aniversário de <br/>
              <span className="font-semibold text-wine-700">{clientName}</span>!
            </motion.p>

            {/* Animated cake */}
            <div className="relative mx-auto w-32 h-32 mb-6">
              {/* Cake base */}
              <motion.div 
                className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-24 h-16 bg-gradient-to-t from-amber-700 to-amber-500 rounded-b-xl"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              />
              
              {/* Cake middle layer */}
              <motion.div 
                className="absolute bottom-12 left-1/2 transform -translate-x-1/2 w-20 h-12 bg-gradient-to-t from-pink-400 to-pink-300 rounded-lg"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
              />
              
              {/* Cake top layer */}
              <motion.div 
                className="absolute bottom-20 left-1/2 transform -translate-x-1/2 w-16 h-8 bg-gradient-to-t from-purple-400 to-purple-300 rounded-lg"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.7, duration: 0.5 }}
              />

              {/* Candles */}
              {[...Array(3)].map((_, i) => (
                <div key={i} className="absolute bottom-28 left-1/2 transform -translate-x-1/2" style={{ marginLeft: `${(i - 1) * 16}px` }}>
                  <motion.div 
                    className="w-1 h-6 bg-yellow-200 rounded-full"
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: 0.9 + i * 0.1 }}
                  />
                  <motion.div 
                    variants={candleFlameVariants}
                    animate="flame"
                    className="w-2 h-3 bg-orange-400 rounded-full -mt-1 ml-[-2px] shadow-sm shadow-orange-300"
                    style={{ filter: "blur(0.5px)" }}
                  />
                </div>
              ))}
            </div>

            {/* Fireworks animation */}
            <AnimatePresence>
              {showFireworks && (
                <>
                  {[...Array(8)].map((_, i) => (
                    <motion.div
                      key={i}
                      variants={fireworkVariants}
                      initial="hidden"
                      animate="visible"
                      className="absolute text-2xl"
                      style={{
                        top: `${20 + Math.random() * 60}%`,
                        left: `${10 + Math.random() * 80}%`,
                        color: confettiColors[i % confettiColors.length]
                      }}
                    >
                      ✨
                    </motion.div>
                  ))}
                </>
              )}
            </AnimatePresence>

            {/* Confetti particles */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: confettiColors[i % confettiColors.length],
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                  }}
                  animate={{
                    y: [0, -20, 20, -10, 0],
                    x: [0, 10, -10, 5, 0],
                    rotate: [0, 180, 360],
                    scale: [0, 1, 0.5, 1, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    delay: Math.random() * 2,
                    ease: "easeInOut"
                  }}
                />
              ))}
            </div>

            {/* Action button */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.5 }}
            >
              <Button 
                onClick={onClose}
                className="bg-wine-600 hover:bg-wine-700 text-white px-6 py-2 rounded-full"
              >
                Que legal! 🎂
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}