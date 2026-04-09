# Hotspot Tooltip System Documentation

## Overview

The GEAR Viewer now includes an interactive tooltip system that displays hotspot information on hover. This feature improves user experience by providing quick context about each hotspot before clicking.

---

## Features

### 1. Increased Hotspot Visibility
- **Default Scale**: `1.5` (increased from `1.0`)
- **Base Geometry**: `0.12` radius sphere with `24` segments
- **Purpose**: Hotspots are now more visible and easier to click, especially in complex 3D scenes

### 2. Hover Tooltips
Tooltips appear automatically when hovering over hotspots, displaying:

| Element | Description |
|---------|-------------|
| **Icon** | Type-specific Font Awesome icon |
| **Title** | Hotspot name in bold |
| **Description** | First 100 characters of content (truncated with `...` if longer) |

### 3. Hotspot Type Icons

| Hotspot Type | Icon | Color |
|--------------|------|-------|
| **Info** | `fa-info-circle` | Purple (`#6366f1`) |
| **Quiz** | `fa-question-circle` | Purple (`#6366f1`) |
| **Audio** | `fa-volume-up` | Green (`#10b981`) |
| **Video** | `fa-video` | Purple (`#6366f1`) |
| **Teleport** | `fa-street-view` | Purple (`#6366f1`) |

---

## How It Works

### Tooltip Display Logic

```javascript
// Triggered on mousemove over the 3D canvas
canvas.addEventListener('mousemove', (event) => {
    // Raycast to detect hotspot under cursor
    var intersects = raycaster.intersectObjects(hotspotMeshes);
    
    if (intersects.length > 0) {
        var hotspot = intersects[0].object.userData;
        
        // Show tooltip (excludes teleport hotspots)
        if (hotspot.visible && hotspot.type !== 'teleport') {
            showTooltip(hotspot, event);
        } else {
            hideTooltip();
        }
    } else {
        hideTooltip();
    }
});
```

### Tooltip Positioning

The tooltip follows the mouse cursor with smart edge detection:

```javascript
// Default offset from cursor
var offsetX = 15;
var offsetY = 15;

// Auto-adjust if near screen edges
if (x + tooltipWidth > window.innerWidth) {
    x = cursorX - tooltipWidth - offsetX; // Flip to left
}
if (y + tooltipHeight > window.innerHeight) {
    y = cursorY - tooltipHeight - offsetY; // Flip above
}
```

---

## Configuration

### Hotspot Scale

The default hotspot scale can be configured per activity:

```javascript
// In viewer.js constructor
this.hotspotScale = (this.config.camera && this.config.camera.hotspotScale) || 1.5;
```

**Recommended Values:**
- `1.0` - Small hotspots (original size)
- `1.5` - Medium hotspots (current default) ✅
- `2.0` - Large hotspots (for accessibility)
- `2.5+` - Very large hotspots (for presentations)

### Customizing Tooltip Appearance

The tooltip styling can be modified in the `showTooltip()` method:

```javascript
this.tooltipElement.style.cssText = 'position:fixed;' +
    'padding:12px;' +
    'background:rgba(0,0,0,0.9);' +
    'color:#fff;' +
    'border-radius:8px;' +
    'pointer-events:none;' +
    'z-index:10000;' +
    'max-width:250px;' +
    'font-size:14px;' +
    'box-shadow:0 4px 12px rgba(0,0,0,0.3);';
```

**Customizable Properties:**
- `padding` - Inner spacing
- `background` - Background color (supports RGBA for transparency)
- `border-radius` - Corner rounding
- `max-width` - Maximum tooltip width
- `font-size` - Text size
- `box-shadow` - Drop shadow effect

---

## Behavior

### When Tooltips Appear
✅ Mouse hovers over visible hotspot  
✅ Hotspot type is NOT `teleport`  
✅ User is NOT in VR mode  

### When Tooltips Hide
❌ Mouse leaves hotspot area  
❌ Hotspot is hidden (locked/branching scenario)  
❌ Hotspot type is `teleport`  
❌ User clicks on hotspot (opens full popup)  

### Performance Optimizations
- **Single DOM Element**: Tooltip is created once and reused
- **No jQuery**: Uses vanilla JavaScript for performance
- **Minimal Raycasting**: Only checks on `mousemove` event
- **Smart Updates**: Position only updates if mouse moves

---

## Accessibility

### Keyboard Navigation
Tooltips are designed for mouse users. Keyboard users can:
- Tab through hotspots in the dropdown menu
- Use Enter/Space to activate hotspots
- Full details appear in the popup (not just tooltip)

### Screen Readers
Tooltips use `aria-label` attributes when present:
```javascript
this.tooltipElement.setAttribute('role', 'tooltip');
this.tooltipElement.setAttribute('aria-label', hotspot.title);
```

---

## Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✅ Full Support |
| Firefox | 88+ | ✅ Full Support |
| Safari | 14+ | ✅ Full Support |
| Edge | 90+ | ✅ Full Support |
| Mobile Chrome | 90+ | ✅ Full Support |
| Mobile Safari | 14+ | ✅ Full Support |

**Note**: Tooltips use standard DOM APIs and work on all modern browsers.

---

## Troubleshooting

### Tooltip Not Appearing

**Possible Causes:**
1. Hotspot is hidden (`visible = false`)
2. Hotspot type is `teleport` (intentionally excluded)
3. Canvas is not receiving mouse events
4. Z-index conflict with other UI elements

**Debug Steps:**
```javascript
// Check if hotspot is being detected
console.log('Hotspot meshes:', this.hotspotMeshes.length);
console.log('Intersects:', intersects.length);

// Check tooltip element
console.log('Tooltip element:', this.tooltipElement);
console.log('Tooltip display:', this.tooltipElement.style.display);
```

### Tooltip Stuck on Screen

**Cause:** `mousemove` event not triggering `hideTooltip()`

**Fix:**
```javascript
// Add to canvas event listeners
this.canvas.addEventListener('mouseleave', () => {
    this.hideTooltip();
});
```

---

## Code Structure

### Key Methods

| Method | Location | Purpose |
|--------|----------|---------|
| `showTooltip(hotspot, event)` | viewer.js:970 | Create and display tooltip |
| `updateTooltipPosition(event)` | viewer.js:1026 | Move tooltip to follow mouse |
| `hideTooltip()` | viewer.js:1047 | Hide tooltip and reset state |

### Instance Variables

| Variable | Type | Purpose |
|----------|------|---------|
| `tooltipElement` | `HTMLElement` | DOM element for tooltip |
| `activeTooltipHotspot` | `Object` | Currently displayed hotspot data |

---

## Future Enhancements

### Planned Features
- [ ] Custom tooltip delay (hover duration before showing)
- [ ] Tooltip animations (fade in/out)
- [ ] Rich text support in tooltips
- [ ] Video thumbnail previews
- [ ] Audio waveform visualization

### Experimental Features
- [ ] Touch support for mobile (long-press to show tooltip)
- [ ] VR mode tooltips (3D floating labels)
- [ ] Custom tooltip themes per activity

---

## Examples

### Basic Tooltip Display

```
┌────────────────────────────┐
│ ️  Ancient Pottery       │
│                            │
│ This pottery dates back    │
│ to 3000 BCE and was used   │
│ for storing grain and      │
│ water...                   │
└────────────────────────────┘
```

### Quiz Hotspot Tooltip

```
┌────────────────────────────┐
│  What is the capital... │
│                            │
│ Test your knowledge about  │
│ the ancient civilization   │
│ you're exploring. Answer   │
│ correctly to unlock the    │
│ next...                    │
└────────────────────────────┘
```

---

**Last Updated:** April 9, 2026  
**Version:** 1.6.0  
**Author:** Boban Blagojevic
