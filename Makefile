.PHONY: default build clean docs git-hook pretty lint test run

default: build

build: lib

clean:
	rm --force --recursive node_modules output tsconfig.tsbuildinfo

docs:
	@echo "This project has no documentation."

git-hook:
	echo "make pretty" > .git/hooks/pre-commit; chmod +x .git/hooks/pre-commit

pretty: node_modules
	npm exec -- biome check --write --no-errors-on-unmatched
	npm pkg fix

lint: node_modules
	npm exec -- biome check .
	npm exec -- tsc --noEmit

test: node_modules
	npm exec -- tsc
	NODE_OPTIONS=--enable-source-maps TZ=UTC npm exec -- c8 --reporter=html-spa mocha output/*.test.js

run: build
	node ./lib/main.js


.PHONY: refresh
refresh: default
	git add .
	git commit -s -m 'chore: Rebuild entrypoint'

node_modules:
	npm install

lib: node_modules
	node build.js
