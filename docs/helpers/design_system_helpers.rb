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
    pages = guide_pages.select { |resource| section_for(resource) == section && (!resource.destination_path.end_with?('/index.html') || ['content/index.html', 'home-assistant/index.html'].include?(resource.destination_path)) }
    pages.group_by { |resource| resource.data.group || (section == 'components' ? 'Home Assistant components' : 'Guidance') }
      .sort_by { |group, _| ['Guidance', 'Brand guidance', 'Writing guide', 'Home Assistant components', 'Home Assistant: controls', 'Home Assistant: flows', 'Form elements', 'Content presentation', 'Navigation', 'Inclusive content', 'Task patterns', 'Page patterns', 'Publishing components', 'Publishing patterns', 'Page templates'].index(group) || 99 }
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
