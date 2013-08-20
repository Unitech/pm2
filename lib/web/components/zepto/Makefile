VERSION=v1.0

default: zepto
	@cd $< && git pull && git checkout $(VERSION) && npm install && npm run-script dist
	@cp -f $</dist/zepto.js .
	@cp -f $</dist/zepto.min.js .
	@du -bh zepto.*

zepto:
	@git clone https://github.com/madrobby/zepto.git $@

.PHONY: default
