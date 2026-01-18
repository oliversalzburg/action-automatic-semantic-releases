.PHONY: default build check-updates clean docs git-hook pretty lint test run

default: build

build: lib/main.js

clean:
	rm --force --recursive node_modules output tsconfig.tsbuildinfo

check-updates: node_modules/.package-lock.json
	npx npm-check-updates

docs:
	@echo "This project has no documentation."

git-hook:
	echo "make pretty" > .git/hooks/pre-commit; chmod +x .git/hooks/pre-commit

pretty: node_modules/.package-lock.json
	npm exec -- biome check --write --no-errors-on-unmatched
	npm pkg fix

lint: node_modules/.package-lock.json
	npm exec -- biome check .
	npm exec -- tsc --noEmit

test: node_modules/.package-lock.json
	npm exec -- tsc
	NODE_OPTIONS=--enable-source-maps TZ=UTC npm exec -- c8 --reporter=html-spa mocha output/*.test.js

run: lib/main.js
	node ./lib/main.js


.PHONY: refresh
refresh: default
	git add .
	git commit -s -m 'chore: Rebuild entrypoint'

node_modules/.package-lock.json: package-lock.json
	npm ci
package-lock.json: package.json
	npm install

lib/main.js: node_modules/.package-lock.json
	node build.js
