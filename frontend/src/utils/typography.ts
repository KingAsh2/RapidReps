// RapidReps Athletic Typography System
// Bold, Strong, Explosive - Sports Team Style

export const Typography = {
  // FONT FAMILIES
  // Using Inter Black (900 weight) as base athletic font
  primary: 'Inter_900Black',
  primaryBold: 'Inter_900Black',
  
  // FONT SIZES - Bold & Impactful
  sizes: {
    hero: 42,        // Main headlines
    title: 32,       // Section titles  
    heading: 24,     // Card headers
    subheading: 20,  // Subheaders
    body: 16,        // Body text
    caption: 14,     // Small text
    tiny: 12,        // Tiny text
  },
  
  // FONT WEIGHTS - Always Bold
  weights: {
    heavy: '900',    // Extra black - titles
    bold: '800',     // Bold - headings
    semibold: '700', // Semi-bold - emphasis
    medium: '600',   // Medium - body
  },
  
  // TEXT STYLES - Pre-configured combinations
  styles: {
    hero: {
      fontSize: 42,
      fontWeight: '900' as any,
      fontStyle: 'italic' as any,
      letterSpacing: 0.5,
      textTransform: 'uppercase' as any,
    },
    title: {
      fontSize: 32,
      fontWeight: '900' as any,
      letterSpacing: 0.3,
    },
    titleItalic: {
      fontSize: 32,
      fontWeight: '900' as any,
      fontStyle: 'italic' as any,
      letterSpacing: 0.3,
    },
    heading: {
      fontSize: 24,
      fontWeight: '800' as any,
      letterSpacing: 0.2,
    },
    headingItalic: {
      fontSize: 24,
      fontWeight: '800' as any,
      fontStyle: 'italic' as any,
      letterSpacing: 0.2,
    },
    subheading: {
      fontSize: 20,
      fontWeight: '700' as any,
    },
    body: {
      fontSize: 16,
      fontWeight: '600' as any,
    },
    bodyBold: {
      fontSize: 16,
      fontWeight: '800' as any,
    },
    button: {
      fontSize: 18,
      fontWeight: '900' as any,
      textTransform: 'uppercase' as any,
      letterSpacing: 1,
    },
    caption: {
      fontSize: 14,
      fontWeight: '600' as any,
    },
  },
};
