.PHONY: default build clean docs pretty lint test run

default: clean build

build: output

clean:
	rm -rf ./output

docs:
	@echo "This project has no documentation."

pretty:
	yarn biome check --write --no-errors-on-unmatched

lint:
	yarn biome check .
	yarn tsc --noEmit

test: clean
	yarn tsc
	yarn c8 --reporter=html-spa node $(shell yarn bin mocha) output/*.test.js

run: clean build
	node ./output/main.js


.PHONY: refresh
refresh: default
	git add .
	git commit -s -m 'chore: Rebuild entrypoint'

node_modules:
	yarn install

output: node_modules
	node build.js
	cp output/main.js lib/main.js
