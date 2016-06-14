
clean:
	find node_modules \( -name "example" -o -name "examples" -o -name "docs" -o -name "jsdoc" -o -name "jsdocs" -o -name "test" -o -name "tests" -o -name "*\.md" -o -name "*\.html" -o -name "*\.eot" -o -name "*\.svg" -o -name "*\.woff" \) -print -exec rm -rf {} \;
	find node_modules -type d \( -name "example" -o -name "examples" -o -name "docs" -o -name "jsdoc" -o -name "jsdocs" -o -name "test" -o -name "tests" -o -name "*\.md" -o -name "*\.html" -o -name "*\.eot" -o -name "*\.svg" -o -name "*\.woff" \) -print -exec rm -rf {} \;
