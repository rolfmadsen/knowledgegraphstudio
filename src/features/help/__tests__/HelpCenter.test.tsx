import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HelpCenter } from '../HelpCenter';

describe('HelpCenter Component', () => {
  it('renders Event Modeling tab button and its content when selected', () => {
    const html = renderToStaticMarkup(<HelpCenter isOpen={true} onClose={() => {}} initialTab="event-modeling" />);
    
    // Check tab navigation button exists
    expect(html).toContain('Event Modeling');
    
    // Check Core Elements
    expect(html).toContain('Core Elements');
    expect(html).toContain('Screen');
    expect(html).toContain('Command');
    expect(html).toContain('Domain Event');
    expect(html).toContain('Read Model');
    expect(html).toContain('Integration Event');
    expect(html).toContain('Automation');

    // Check 4 Event Model Patterns
    expect(html).toContain('4 Event Model Patterns');
    expect(html).toContain('State Change Pattern');
    expect(html).toContain('State View Pattern');
    expect(html).toContain('Automation Pattern');
    expect(html).toContain('Translation Pattern (System integration)');

    // Check 4 Anti-Patterns
    expect(html).toContain('The 4 Anti-Patterns (Overcomplication)');
    expect(html).toContain('The Left Chair');
    expect(html).toContain('The Right Chair');
    expect(html).toContain('The Bed');
    expect(html).toContain('The Bookshelf');
  });
});
