import React, { ElementType } from 'react';
import { motion, useInView } from 'framer-motion';

interface TimelineContentProps {
    children?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    animationNum: number;
    customVariants?: any;
    timelineRef?: React.RefObject<Element | null>;
    as?: ElementType;
    href?: string;
    target?: string;
    rel?: string;
}

export function TimelineContent({
    children,
    className,
    style,
    animationNum,
    customVariants,
    timelineRef,
    as = 'div',
    href,
    target,
    rel,
    ...props
}: TimelineContentProps) {
    const isInView = useInView(timelineRef || { current: null }, { once: true, margin: "-100px" });

    const defaultVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: { delay: i * 0.2, duration: 0.5 }
        })
    };

    const variants = customVariants || defaultVariants;
    const MotionComponent = motion(as as any) as any;

    return (
        <MotionComponent
            className={className}
            style={style}
            variants={variants}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            custom={animationNum}
            href={href}
            target={target}
            rel={rel}
            {...props}
        >
            {children}
        </MotionComponent>
    );
}
