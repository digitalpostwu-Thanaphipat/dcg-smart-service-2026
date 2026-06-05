# Design System: WUS Track DCG

## 🎨 Visual Identity
The system uses a **"Postal Modern"** aesthetic: clean, efficient, but with premium "glassmorphism" and "claymorphism" accents to represent technology and security.

### Color Palette (Walailak University Inspired)
- **Primary (WU Orange)**: `hsl(25, 100%, 50%)` -> Energetic, Attention.
- **Secondary (WU Purple)**: `hsl(270, 50%, 30%)` -> Trust, Academic.
- **Background**: Sleek Dark Mode (`hsl(220, 20%, 10%)`) with deep blue tints.
- **Surface**: Translucent Glass (`hsla(220, 20%, 20%, 0.7)`) with backdrop blur.

### Typography
- **Primary**: `Outfit`, sans-serif (Geometric, Friendly).
- **Secondary**: `Inter`, sans-serif (Highly readable for data).
- **Fallback**: System sans-serif.

## ✨ Motion & Interactions
- **Transitions**: 300ms "Spring" animations via Framer Motion.
- **Micro-animations**: Subtle scale-up on button hover, loading shimmers, and layout animations for list changes.
- **Haptic Feedback**: Visual pulses for touch interactions.

## 🧱 Core Components
1. **GlassCard**: Container with 12px border radius, 1px border (`hsla(0, 0%, 100%, 0.1)`), and backdrop blur.
2. **ActionButton**: High-contrast button with a subtle gradient and shadow.
3. **StatusBadge**: Pill-shaped indicator with glowing borders for 'Pending' or 'Synced'.
4. **SmartInput**: Input field with focused glowing borders and floating labels.

## 📏 Layout System
- **Grid**: 8px based spacing system.
- **Mobile First**: Optimized for one-handed operation (bottom-sheet menus, large touch targets).
- **Responsiveness**: Fluid scaling for tablet and desktop views.

## ♿ Accessibility (WCAG 2.2 AA)
- **Contrast**: Minimum 4.5:1 for all text elements.
- **Aria**: Full ARIA labels for all interactive elements.
- **Keyboard**: Logical tab order and visible focus states (WU Orange glow).
