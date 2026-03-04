import { motion, Variants, AnimatePresence, useMotionValue, useTransform, animate, useInView } from 'framer-motion';
import React, { useState, useEffect, useCallback, useRef } from 'react';

interface ImageRevealProps {
    leftImage: string;
    middleImage: string;
    rightImage: string;
}

function Counter({ targetValue, duration }: { targetValue: number; duration: number }) {
    const count = useMotionValue(0);
    const rounded = useTransform(count, (latest) => Math.round(latest));
    const displayValue = useTransform(rounded, (latest) => `+${latest.toLocaleString('pt-BR')}`);
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-100px" });

    useEffect(() => {
        if (isInView) {
            const controls = animate(count, targetValue, {
                duration: duration,
                ease: "easeOut"
            });
            return controls.stop;
        }
    }, [isInView, count, targetValue, duration]);

    return (
        <div ref={ref} className="works-counter-badge">
            <motion.p>{displayValue}</motion.p>
            <p>Obras executadas com sucesso</p>
        </div>
    );
}

export default function ImageReveal({ leftImage, middleImage, rightImage }: ImageRevealProps) {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const closeModal = useCallback(() => setSelectedImage(null), []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeModal();
        };
        if (selectedImage) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [selectedImage, closeModal]);

    const containerVariants: Variants = {
        initial: { opacity: 0 },
        animate: {
            opacity: 1,
            transition: { delay: 0.2, staggerChildren: 0.2 }
        }
    };

    const leftImageVariants: Variants = {
        initial: { rotate: 0, x: 0, y: 0 },
        animate: {
            rotate: -10, x: -110, y: -30,
            transition: { type: "spring" as const, stiffness: 120, damping: 12 }
        },
        hover: {
            rotate: -5, x: -120, y: -45,
            transition: { type: "spring" as const, stiffness: 200, damping: 15 }
        }
    };

    const middleImageVariants: Variants = {
        initial: { rotate: 0, x: 0, y: 0 },
        animate: {
            rotate: 4, x: 10, y: -50,
            transition: { type: "spring" as const, stiffness: 120, damping: 12 }
        },
        hover: {
            rotate: 0, x: 10, y: -60,
            transition: { type: "spring" as const, stiffness: 200, damping: 15 }
        }
    };

    const rightImageVariants: Variants = {
        initial: { rotate: 0, x: 0, y: 0 },
        animate: {
            rotate: 8, x: 150, y: -20,
            transition: { type: "spring" as const, stiffness: 120, damping: 12 }
        },
        hover: {
            rotate: 5, x: 155, y: -35,
            transition: { type: "spring" as const, stiffness: 200, damping: 15 }
        }
    };

    return (
        <>
            <motion.div
                className="relative flex items-center justify-center w-full h-[500px]"
                variants={containerVariants}
                initial="initial"
                whileInView="animate"
                viewport={{ once: true }}
            >
                {/* Left Image */}
                <motion.div
                    className="absolute w-[330px] h-[330px] origin-bottom-right overflow-hidden rounded-xl shadow-lg bg-white cursor-pointer"
                    variants={leftImageVariants}
                    whileHover="hover"
                    animate="animate"
                    style={{ zIndex: 20 }}
                    onClick={() => setSelectedImage(leftImage)}
                >
                    <img
                        src={leftImage}
                        alt="Left image"
                        className="object-contain w-full h-full p-2 rounded-xl"
                    />
                </motion.div>

                {/* Middle Image */}
                <motion.div
                    className="absolute w-[330px] h-[330px] origin-bottom-left overflow-hidden rounded-xl shadow-2xl bg-white cursor-pointer"
                    variants={middleImageVariants}
                    whileHover="hover"
                    animate="animate"
                    style={{ zIndex: 30 }}
                    onClick={() => setSelectedImage(middleImage)}
                >
                    <img
                        src={middleImage}
                        alt="Middle image"
                        className="object-contain w-full h-full p-2 rounded-2xl"
                    />
                </motion.div>

                {/* Right Image */}
                <motion.div
                    className="absolute w-[330px] h-[330px] origin-bottom-right overflow-hidden rounded-xl shadow-lg bg-white cursor-pointer"
                    variants={rightImageVariants}
                    whileHover="hover"
                    animate="animate"
                    style={{ zIndex: 10 }}
                    onClick={() => setSelectedImage(rightImage)}
                >
                    <img
                        src={rightImage}
                        alt="Right image"
                        className="object-contain w-full h-full p-2 rounded-2xl"
                    />
                </motion.div>

                <Counter targetValue={5000} duration={4} />
            </motion.div>

            {/* Modal Overlay */}
            <AnimatePresence>
                {selectedImage && (
                    <motion.div
                        className="fixed inset-0 flex items-center justify-center"
                        style={{ zIndex: 9999, background: 'rgba(0, 0, 0, 0.6)' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        onClick={closeModal}
                    >
                        <motion.img
                            src={selectedImage}
                            alt="Preview"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                maxWidth: '600px',
                                width: '90%',
                                maxHeight: '90vh',
                                aspectRatio: '1 / 1',
                                objectFit: 'contain',
                                borderRadius: '12px',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                                background: 'white',
                                padding: '8px',
                            }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
