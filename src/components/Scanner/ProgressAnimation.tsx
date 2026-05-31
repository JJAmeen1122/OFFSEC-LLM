// components/Scanner/ProgressAnimation.tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProgressAnimationProps {
  currentPhase: string;
  progress: number;
  phases: string[];
}

export const ProgressAnimation: React.FC<ProgressAnimationProps> = ({ 
  currentPhase, 
  progress, 
  phases 
}) => {
  return (
    <div className="progress-container">
      <div className="phases-timeline">
        {phases.map((phase, idx) => (
          <motion.div
            key={phase}
            className={`phase-step ${currentPhase === phase ? 'active' : ''} 
                       ${phases.indexOf(currentPhase) > idx ? 'completed' : ''}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <div className="phase-marker">
              {phases.indexOf(currentPhase) > idx ? '✓' : idx + 1}
            </div>
            <span className="phase-name">{phase}</span>
          </motion.div>
        ))}
      </div>
      
      <div className="progress-bar-container">
        <motion.div 
          className="progress-bar-fill"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <motion.div 
            className="progress-shimmer"
            animate={{ x: ['-100%', '100%'] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          />
        </motion.div>
      </div>
      
      <motion.div 
        className="progress-text"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        {progress}% - {currentPhase}
      </motion.div>
    </div>
  );
};