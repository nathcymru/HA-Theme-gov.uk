require 'govuk_tech_docs'
require 'json'
require 'pathname'
require 'yaml'
require 'date'
require 'digest'

# A direct Middleman build has the same public-data gate as the Node build.
# Network access belongs to the explicit trusted refresh step, never a visitor.
unless system('node', File.expand_path('../scripts/roadmap.mjs', __dir__), '--check',
              '--output', File.expand_path('data/roadmap.json', __dir__))
  raise 'Roadmap data is invalid. Run npm run roadmap:check from the repository root.'
end

unless system('node', File.expand_path('../scripts/audit-licences.mjs', __dir__), chdir: File.expand_path('..', __dir__))
  raise 'Licence evidence is out of date. Review the dependency inventory before building.'
end

# The official Tech Docs Template supplies Markdown rendering, code highlighting,
# component styles, page metadata and table-of-contents helpers.
GovukTechDocs.configure(self)
set :relative_links, true
activate :relative_assets
set :layout, :civica
set :css_dir, 'stylesheets'
set :js_dir, 'javascripts'
set :images_dir, 'images'

# Content hashes keep newly published HTML from reusing older cached styles or
# scripts. Supplied artwork keeps its original filename and byte identity.
configure :build do
  activate :asset_hash, exts: %w(.css .js)
end

# A separate identity must never publish upstream crown, logotype or font assets.
ignore 'assets/govuk/**'
ignore 'fonts/**'
ignore 'images/anchored-heading*'
ignore 'images/govuk-*'
ignore 'images/search-*'
ignore 'javascripts/application.js'
ignore 'javascripts/govuk_frontend.js'
ignore 'stylesheets/manifest.css'
ignore 'stylesheets/print.css'
ignore 'stylesheets/screen-old-ie.css'
page '*.json', layout: false
page '*.txt', layout: false
page '*.webmanifest', layout: false

examples = Dir[File.join(__dir__, 'data', '*examples.yml')].sort.reduce({}) do |all, path|
  entries = YAML.safe_load(File.read(path), permitted_classes: [Date], aliases: false).fetch('examples', {})
  overlap = all.keys & entries.keys
  raise "Duplicate example IDs: #{overlap.join(', ')}" unless overlap.empty?
  entries.each_value do |entry|
    # A demonstration must not submit a GET request when JavaScript is absent.
    # The same normalised markup is used for the preview and displayed source.
    fragment = Nokogiri::HTML::DocumentFragment.parse(entry.fetch('html'))
    fragment.css('form[data-demo-form]').each do |form|
      form.css('input, select, textarea, button').each do |control|
        next if control['disabled']
        control['disabled'] = 'disabled'
        control['data-demo-enable'] = ''
      end
      notice = Nokogiri::XML::Node.new('noscript', fragment.document)
      notice.content = 'This interactive form example needs JavaScript. No data is submitted.'
      form.add_child(notice)
    end
    if fragment.at_css('main') && !fragment.at_css('h1')
      heading = Nokogiri::XML::Node.new('h1', fragment.document)
      heading['class'] = 'govuk-visually-hidden'
      heading.content = entry.fetch('title')
      fragment.at_css('main').prepend_child(heading)
    end
    entry['has_main'] = !fragment.at_css('main').nil?
    entry['has_h1'] = !fragment.at_css('h1').nil?
    entry['html'] = fragment.to_html
  end
  all.merge(entries)
end
set :civica_examples, examples
ignore 'example.html'
examples.each_key do |id|
  raise "Unsafe example ID: #{id}" unless id.match?(/\A[a-z0-9-]+\z/)
  proxy "/examples/#{id}.html", '/example.html', locals: { example_id: id }, layout: false
end

helpers do
  def docs_path(path)
    Pathname.new(path).relative_path_from(Pathname.new('/' + current_page.destination_path).dirname).to_s
  end

  def current_section
    current_page.data.section || current_page.url.split('/')[1] || 'home'
  end

  def palette_data
    JSON.parse(File.read(File.expand_path('../design-system/palettes.json', root)))
  end
end

# Publish the exact reviewed notices beside the page rendered from LICENSE.md.
after_build do
  destination = File.join(config[:build_dir], 'reference', 'licences')
  FileUtils.rm_rf(destination)
  FileUtils.mkdir_p(File.dirname(destination))
  FileUtils.cp_r(File.expand_path('../licences', root), destination)
end
