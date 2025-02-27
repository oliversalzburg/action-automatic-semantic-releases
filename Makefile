.PHONY: default build clean docs git-hook pretty lint test run

default: build

build: output

clean:
	rm --force --recursive node_modules output tsconfig.tsbuildinfo

docs:
	@echo "This project has no documentation."

git-hook:
	echo "make pretty" > .git/hooks/pre-commit

pretty: node_modules
	yarn biome check --write --no-errors-on-unmatched
	npm pkg fix

lint: node_modules
	yarn biome check .
	yarn tsc --noEmit

test:
	yarn tsc
	yarn c8 --reporter=html-spa node $(shell yarn bin mocha) output/*.test.js

run: build
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
