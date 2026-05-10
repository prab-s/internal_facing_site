export function buildTemplateBlocks() {
  return [
    {
      id: 'text',
      label: 'Text',
      category: 'Basics',
      content: '<div class="template-text">Double-click to edit this text.</div>'
    },
    {
      id: 'heading',
      label: 'Heading',
      category: 'Basics',
      content: '<h2>Heading</h2>'
    },
    {
      id: 'button',
      label: 'Button',
      category: 'Basics',
      content: '<a class="btn btn-primary" href="#">Button</a>'
    },
    {
      id: 'quote',
      label: 'Quote',
      category: 'Basics',
      content: '<blockquote class="blockquote mb-0"><p>Write a memorable quote.</p></blockquote>'
    },
    {
      id: 'divider',
      label: 'Divider',
      category: 'Basics',
      content: '<hr />'
    },
    {
      id: 'section',
      label: 'Section',
      category: 'Layout',
      content: '<section class="template-section"><h2>Section</h2><p>Content</p></section>'
    },
    {
      id: 'two-col',
      label: 'Two Columns',
      category: 'Layout',
      content:
        '<div style="display:flex; gap:1rem; align-items:stretch; flex-wrap:wrap;"><div style="flex:1 1 0; min-width:0;"><p>Left</p></div><div style="flex:1 1 0; min-width:0;"><p>Right</p></div></div>'
    },
    {
      id: 'three-col',
      label: 'Three Columns',
      category: 'Layout',
      content:
        '<div style="display:flex; gap:1rem; align-items:stretch; flex-wrap:wrap;"><div style="flex:1 1 0; min-width:0;"><p>Left</p></div><div style="flex:1 1 0; min-width:0;"><p>Center</p></div><div style="flex:1 1 0; min-width:0;"><p>Right</p></div></div>'
    },
    {
      id: 'image-text',
      label: 'Image + Text',
      category: 'Layout',
      content:
        '<div style="display:flex; gap:1rem; align-items:center; flex-wrap:wrap;"><div style="flex:1 1 18rem; min-width:0;"><img src="{{product.primary_product_image_url}}" alt="Template image" style="max-width:100%; height:auto;" /></div><div style="flex:1 1 18rem; min-width:0;"><h2>Heading</h2><p>Describe the product or series here.</p></div></div>'
    },
    {
      id: 'text-media',
      label: 'Text + Media',
      category: 'Layout',
      content:
        '<div style="display:flex; gap:1rem; align-items:flex-start; flex-wrap:wrap;"><div style="flex:1 1 20rem; min-width:0;"><h2>Heading</h2><p>Write supporting content here.</p></div><div style="flex:1 1 16rem; min-width:0;"><img src="{{product.primary_product_image_url}}" alt="Template image" style="max-width:100%; height:auto;" /></div></div>'
    },
    {
      id: 'image',
      label: 'Image',
      category: 'Media',
      content: '<img src="{{product.primary_product_image_url}}" alt="Template image" />'
    },
    {
      id: 'video',
      label: 'Video',
      category: 'Media',
      content: '<video controls><source src="" type="video/mp4" /></video>'
    },
    {
      id: 'map',
      label: 'Map',
      category: 'Media',
      content:
        '<iframe title="Map" src="https://www.google.com/maps?q=New%20Zealand&output=embed" width="600" height="400" loading="lazy"></iframe>'
    },
    {
      id: 'link',
      label: 'Link',
      category: 'Basics',
      content: '<a href="#">Read more</a>'
    },
    {
      id: 'form',
      label: 'Form',
      category: 'Forms',
      content:
        '<form><div class="mb-3"><label class="form-label">Email</label><input type="email" class="form-control" placeholder="name@example.com" /></div><button class="btn btn-primary" type="submit">Submit</button></form>'
    },
    { id: 'spec-table', label: 'Specs Table', category: 'Data', content: '<div>{{product.grouped_specs_table}}</div>' },
    { id: 'product-graph', label: 'Product Graph', category: 'Data', content: '<div>{{product.graph_image_tag}}</div>' },
    { id: 'series-graph', label: 'Series Graph', category: 'Data', content: '<div>{{series.graph_image_tag}}</div>' },
    { id: 'product-pdf-title', label: 'Product Title', category: 'Data', content: '<h1>{{product.model}}</h1>' },
    { id: 'series-title', label: 'Series Title', category: 'Data', content: '<h1>{{series.name}}</h1>' },
    { id: 'pdf-page-break', label: 'Page Break', category: 'PDF', content: '<div class="pdf-page-break">Page break</div>' },
    { id: 'pdf-no-break', label: 'No Split', category: 'PDF', content: '<div class="pdf-avoid-break">Avoid page split</div>' }
  ];
}
