require 'rake'
require 'rake/clean'

task :default => :test

ROOT = File.expand_path('..', __FILE__)
MUSTACHE_JS = File.read(File.join(ROOT, 'mustache.js'))

def mustache_version
  match = MUSTACHE_JS.match(/exports\.version = "([^"]+)";/)
  match[1]
end

def minified_file
  ENV['FILE'] || 'mustache.min.js'
end

desc "Run all tests, requires vows (see http://vowsjs.org)"
task :test do
  sh "vows --spec"
end

desc "Minify to #{minified_file}, requires UglifyJS (see http://marijnhaverbeke.nl/uglifyjs)"
task :minify do
  sh "uglifyjs mustache.js > #{minified_file}"
end

desc "Run JSHint, requires jshint (see http://www.jshint.com)"
task :lint do
  sh "jshint mustache.js"
end

# Creates a task that uses the various template wrappers to make a wrapped
# output file. There is some extra complexity because Dojo and YUI use
# different final locations.
def templated_build(name, opts={})
  short = name.downcase
  source = File.join("wrappers", short)
  dependencies = ["mustache.js"] + Dir.glob("#{source}/*.tpl.*")
  target_js = opts[:location] ? "mustache.js" : "#{short}.mustache.js"

  CLEAN.include(opts[:location] ? opts[:location] : target_js)

  desc "Package for #{name}"
  task short.to_sym => dependencies do
    puts "Packaging for #{name}"

    mkdir_p opts[:location] if opts[:location]

    files = [
      "#{source}/mustache.js.pre",
      'mustache.js',
      "#{source}/mustache.js.post"
    ]

    open("#{opts[:location] || '.'}/#{target_js}", 'w') do |f|
      files.each {|file| f << File.read(file) }
    end

    puts "Done, see #{opts[:location] || '.'}/#{target_js}"
  end
end

templated_build "jQuery"
templated_build "MooTools"
templated_build "Dojo", :location => "dojox/string"
templated_build "YUI3", :location => "yui3/mustache"
templated_build "qooxdoo"
