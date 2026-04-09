# RapidReps Design Guidelines — Premium Dark Theme

## Color Palette
| Token | Value | Usage |
|-------|-------|-------|
| bg | `#0A0E1A` | Screen backgrounds |
| bgCard | `#141929` | Card backgrounds, modals |
| bgElevated | `#1A2035` | Secondary cards |
| accent | `#FF6A00` | Primary orange accent |
| accentLight | `#FF9F1C` | Gradient end, hover states |
| textPrimary | `#FFFFFF` | Headings, primary text |
| textSecondary | `rgba(255,255,255,0.7)` | Body text |
| textMuted | `rgba(255,255,255,0.45)` | Labels, timestamps |
| border | `rgba(255,255,255,0.08)` | Card borders |
| success | `#00D68F` | Active indicators, success states |
| error | `#FF4757` | Error states, logout |

## Core Principles
- **Dark backgrounds** — `#0A0E1A` as primary, never white
- **Orange as accent only** — buttons, highlights, glows, not backgrounds
- **Glassmorphism cards** — semi-transparent with subtle borders
- **Depth via shadows** — orange glow on accent elements, dark shadows on cards
- **Selected states** — orange gradient (`#FF6A00` → `#FF9F1C`) with glow shadow

## Screen Overlays
All screens use:
```
LinearGradient colors={['rgba(10, 14, 26, 0.92)', 'rgba(17, 24, 39, 0.88)']}
```

## Tab Bar
- Background: `#0D1117`
- Active: `#FF6A00`
- Inactive: `rgba(255,255,255,0.4)`
- Top border: `rgba(255,255,255,0.06)`

## Cards
```
backgroundColor: '#141929'
borderWidth: 1
borderColor: 'rgba(255,255,255,0.08)'
shadowColor: '#000'
shadowOpacity: 0.3
shadowRadius: 12
```

## Selected/Active States
```
backgroundColor: '#FF6A00'
shadowColor: '#FF6A00'
shadowOpacity: 0.3
shadowRadius: 8
borderColor: 'rgba(255,106,0,0.3)'
```
