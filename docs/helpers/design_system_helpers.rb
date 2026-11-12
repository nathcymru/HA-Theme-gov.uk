module DesignSystemHelpers
  def escape(value)
    ERB::Util.html_escape(value.to_s)
  end

  def home_page?
    current_page.destination_path == 'index.html'
  end

  def guide_pages
    sitemap.resources.select do |resource|
      resource.destination_path.end_with?('.html') && resource.data.title &&
        !resource.destination_path.start_with?('examples/') && !resource.ignored?
    end
  end

  def section_for(resource)
    resource.data.section || resource.destination_path.split('/').first
  end

  def section_groups(section)
    section_home = data.navigation.sections.find { |item| item.id == section }&.path
    pages = guide_pages.select do |resource|
      section_for(resource) == section && '/' + resource.destination_path != section_home &&
        (!resource.destination_path.end_with?('/index.html') || resource.destination_path == 'home-assistant/index.html')
    end
    pages.group_by { |resource| resource.data.group || (section == 'components' ? 'Home Assistant components' : 'Guidance') }
      .sort_by { |group, _| ['Guidance', 'Brand guidance', 'Writing standards', 'Home Assistant terminology', 'Quick reference', 'Home Assistant components', 'Home Assistant: controls', 'Home Assistant: flows', 'Form elements', 'Content presentation', 'Navigation', 'Inclusive content', 'Task patterns', 'Page patterns', 'Publishing components', 'Publishing patterns', 'Page templates'].index(group) || 99 }
      .map { |group, resources| [group, resources.sort_by { |resource| [resource.data.nav_order || 100, resource.data.title.downcase] }] }
  end

  # Search includes section hubs, which are intentionally absent from their own
  # sidebar. Keep this collection independent of the navigation filter.
  def search_groups
    guide_pages.reject { |resource| ['search.html', 'sitemap.html'].include?(resource.destination_path) }
      .group_by { |resource| resource.destination_path == 'index.html' ? 'Start here' : (data.navigation.sections.find { |item| item.id == section_for(resource) }&.title || 'Guidance') }
      .map { |group, resources| [group, resources.sort_by { |resource| resource.data.title.downcase }] }
  end

  def example(id)
    spec = config[:civica_examples].fetch(id) { raise "Unknown example #{id}" }
    partial 'partials/example', locals: { id: id, spec: spec }
  end

  # Resolve catalogue assets before escaping code examples. Middleman's normal
  # URL rewriter handles rendered tags, but cannot rewrite escaped code panels.
  # Both outputs use URLs relative to the standalone /examples/ document.
  def example_html(spec)
    html = spec.fetch('html')
    return html unless html.match?(/\.(?:css|js)(?:[?"'#]|\s)/)

    fragment = Nokogiri::HTML::DocumentFragment.parse(html)
    fragment.css('script[src], link[rel="stylesheet"][href]').each do |node|
      attribute = node.name == 'script' ? 'src' : 'href'
      uri = Addressable::URI.parse(node[attribute])
      next unless uri.scheme.nil? && uri.host.nil?
      next unless %w(.css .js).include?(File.extname(uri.path))

      source_path = Pathname.new('/examples').join(uri.path).cleanpath.to_s
      resource = sitemap.find_resource_by_path(source_path)
      next unless resource

      uri.path = Pathname.new('/' + resource.destination_path)
        .relative_path_from(Pathname.new('/examples')).to_s
      node[attribute] = uri.to_s
    end
    fragment.to_html
  end

  def component_family
    @civica_family_record ||= JSON.parse(File.read(File.join(root, 'data', 'component-rationalisation.json')))
    route = '/' + current_page.destination_path
    page = @civica_family_record['pageInventory'].find { |item| item['url'] == route }
    return nil unless page
    family = @civica_family_record['families'].find { |item| item['id'] == page['familyId'] }
    return nil unless family && family['memberPages'].length > 1
    { page: page, family: family, pages: @civica_family_record['pageInventory'] }
  end

  def page_history
    stored = data.respond_to?(:page_history) ? data.page_history[current_page.destination_path] : nil
    changes = current_page.data.updates || (stored && stored['updates'])
    raise "Missing page history: #{current_page.destination_path}" unless changes && !changes.empty?
    {
      published: current_page.data.published_on || stored['published_on'],
      updated: current_page.data.updated_on || stored['updated_on'],
      changes: changes
    }
  end

  def readable_date(value)
    Date.parse(value.to_s).strftime('%-d %B %Y')
  end
end
