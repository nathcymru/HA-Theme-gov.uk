---
title: "Documentation architecture"
description: "Documentation architecture for the civica.uk Home Assistant design system."
last_reviewed_on: 2026-11-11
review_in: 3 months
---

# Documentation architecture

This `/docs` folder is a real GOV.UK Tech Docs Template site powered by Middleman and the pinned `govuk_tech_docs` gem. The Markdown renderer, syntax highlighting, component foundations and contents helpers come from that template.

## Follow the Design System layout

The information architecture follows [alphagov/govuk-design-system](https://github.com/alphagov/govuk-design-system): Get started, Styles, Components, Patterns, Community and Accessibility. Pages use a common header, service navigation, section navigation, main content and footer.

The upstream website itself uses Node, `src`, `views`, `data` and build tasks. It is not a Middleman project. This repository deliberately maps its layout and content organisation to Middleman's `source`, `layouts`, `data`, `helpers` and `config` directories rather than claiming to copy its build stack.

## Local structure

```text
docs/
  Gemfile                 # Pinned govuk_tech_docs dependency
  Gemfile.lock            # Resolved dependency versions
  config.rb               # Official template setup and local exclusions
  config/tech-docs.yml    # Template configuration
  data/navigation.yml    # Shared page navigation
  source/                # Human-readable Markdown and assets
    layouts/             # Unbranded civica.uk shell
    stylesheets/         # Selected GOV.UK/Tech Docs styles + local layout
    javascripts/         # Documentation demonstration behaviour
    design-contract.json # Machine-readable rules and scope
    llms.txt             # AI reading guide
  scripts/               # Documentation validation
```

## Keep the build unbranded

Set `show_govuk_logo: false`, replace the shell and favicon paths, omit default font-face rules and import only the needed component styles. The published site excludes upstream branded images and font files. The fact that a dependency contains official assets does not mean those assets may be published in civica.uk.

## Build and preview

Use Ruby 3.3 and Bundler. From `/docs`, run `bundle install`, then `bundle exec middleman build`. Use `bundle exec middleman server` for a local preview. Run the documentation validator after building.

Commit content, configuration and the lockfile. Do not commit `build/`, `vendor/` or `.bundle/`. Publish the generated `build/` directory through the repository's chosen static hosting workflow.

The [Tech Docs Template](https://github.com/alphagov/tech-docs-template) explains its Middleman origin and non-government branding requirements.
