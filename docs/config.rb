require 'govuk_tech_docs'
require 'json'
require 'pathname'

# The official Tech Docs Template supplies Markdown rendering, code highlighting,
# component styles, page metadata and table-of-contents helpers.
GovukTechDocs.configure(self)
set :relative_links, true
activate :relative_assets
set :layout, :civica
set :css_dir, 'stylesheets'
set :js_dir, 'javascripts'
set :images_dir, 'images'

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

helpers do
  def docs_path(path)
    Pathname.new(path).relative_path_from(Pathname.new('/' + current_page.destination_path).dirname).to_s
  end

  def current_section
    current_page.url.split('/')[1] || 'home'
  end

  def palette_data
    JSON.parse(File.read(File.expand_path('../design-system/palettes.json', root)))
  end
end
