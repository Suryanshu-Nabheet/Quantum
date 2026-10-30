import { expect, test } from "vitest";
import { formatGrepSearchResults } from "./grepSearch";

// Sample grep output mimicking what would come from ripgrep with the params:
// ripgrep -i --ignore-file .agentignore --ignore-file .gitignore -C 2 --heading -m 100 -e <query> .
const sampleGrepOutput = `./program.cs
        Console.WriteLine("Hello World!");
        Calculator calc = new Calculator();
        calc.Add(5).Subtract(3);
        Console.WriteLine("Result: " + calc.GetResult());
    }
--
        }

        public Calculator Subtract(double number)
        {
            result -= number;

./test.kt
    }

    fun subtract(number: Double): Test {
        result -= number
        return this

./test.php
    }

    public function subtract($number) {
        $this->result -= $number;
        return $this;
--

$calc = new Calculator();
$calc->add(10)->subtract(5);
echo "Result: " . $calc->getResult() . "\n";


./Calculator.java
    }

    public Calculator subtract(double number) {
        result -= number;
        return this;
--
    public static void main(String[] args) {
        Calculator calc = new Calculator();
        calc.add(10).subtract(5);
        System.out.println("Result: " + calc.getResult());
    }

./calculator_test/Calculator.java
    }

    public int subtract(int a, int b) {
        return a - b;
    }

./test.rb
  end

  def subtract(number)
    @result -= number
    self
--

calc = Calculator.new
calc.add(5).subtract(3)
puts "Result: #{calc.get_result}"

./test.js
    return this;
  }
  subtract(number) {
    return this;
  }

./test.py
        return self

    def subtract(self, number):
        self.result -= number
        return self

./test.ts
  }

  subtract(number: number): Calculator {
    this.result -= number;
    return this;`;

test("formats grep search results correctly", () => {
  const result = formatGrepSearchResults(sampleGrepOutput);

  expect(result.numResults).toBe(9); // Files with at least one matching line
  expect(result.truncated).toBe(false);

  // Check that all file paths are preserved
  expect(result.formatted).toContain("./program.cs");
  expect(result.formatted).toContain("./test.kt");
  expect(result.formatted).toContain("./test.php");
  expect(result.formatted).toContain("./Calculator.java");

  // Check that content is preserved and properly indented
  expect(result.formatted).toContain('Console.WriteLine("Hello World!");');
  expect(result.formatted).toContain("fun subtract(number: Double): Test {");
  expect(result.formatted).toContain("public function subtract($number) {");
  expect(result.formatted).toContain(
    "public Calculator subtract(double number) {",
  );
});

test("handles empty input", () => {
  const result = formatGrepSearchResults("");

  expect(result.numResults).toBe(0);
  expect(result.truncated).toBe(false);
  expect(result.formatted).toBe("");
});

test("handles input with only file paths (no content) - lines should be skipped", () => {
  const input =
    "./empty-file.ts\n./another-empty.js\n./has-content.ts\n searchMatch";
  const result = formatGrepSearchResults(input);

  expect(result.numResults).toBe(1);
  expect(result.numFiles).toBe(1);
  expect(result.formatted).toBe("./has-content.ts\n  searchMatch");
});

test("formats native workbench URI headings as separate search results", () => {
  const input = [
    "file:///workspace/app/src/first.ts",
    "12: first match",
    "https://docs.example.test/search",
    "--",
    "18: another match in the same file",
    "vscode-remote://ssh-remote+host/workspace/app/src/second.ts",
    "3: second file match",
  ].join("\n");

  const result = formatGrepSearchResults(input);

  expect(result.numResults).toBe(2);
  expect(result.formatted).toContain("file:///workspace/app/src/first.ts");
  expect(result.formatted).toContain("12: first match");
  expect(result.formatted).toContain("https://docs.example.test/search");
  expect(result.formatted).toContain("18: another match in the same file");
  expect(result.formatted).toContain(
    "vscode-remote://ssh-remote+host/workspace/app/src/second.ts",
  );
  expect(result.formatted).toContain("3: second file match");
  expect(result.formatted).not.toContain("--");
});

test("omits sensitive file contents from formatted search results", () => {
  const input = [
    "file:///workspace/app/secrets/nested/credentials.txt",
    "1: private-value",
    "file:///workspace/app/src/app.ts",
    "1: safe-result",
  ].join("\n");

  const result = formatGrepSearchResults(input);

  expect(result.numResults).toBe(1);
  expect(result.numFiles).toBe(2);
  expect(result.formatted).not.toContain("private-value");
  expect(result.formatted).not.toContain("credentials.txt");
  expect(result.formatted).toContain("safe-result");
});

test("truncates output when exceeding maxChars", () => {
  const maxChars = 50;
  const result = formatGrepSearchResults(sampleGrepOutput, maxChars);

  expect(result.truncated).toBe(true);
  expect(result.formatted.length).toBe(maxChars);
});

test("normalizes indentation to 2 spaces", () => {
  const input = `./file.ts
    function test() {
      const x = 1;
        console.log(x);
    }`;

  const result = formatGrepSearchResults(input);

  // The function should normalize the indentation to 2 spaces
  expect(result.formatted).toContain("./file.ts");
  expect(result.formatted).toContain("  function test() {");
  expect(result.formatted).toContain("    const x = 1;");
  expect(result.formatted).toContain("      console.log(x);");
  expect(result.formatted).toContain("  }");
});

test("skips leading single-char or empty lines after file paths", () => {
  const input = `./file.ts
 
function test() {
  console.log("test");
}`;

  const result = formatGrepSearchResults(input);

  expect(result.formatted).toContain("./file.ts");
  expect(result.formatted).not.toContain("\n \n"); // The single space line should be skipped
  expect(result.formatted).toContain("function test() {");
});

test("processes separator lines correctly", () => {
  const input = `./file1.ts
function one() {
  return 1;
}
--
function two() {
  return 2;
}

./file2.ts
class Test {
  method() {}
}`;

  const result = formatGrepSearchResults(input);

  expect(result.numResults).toBe(2);
  expect(result.formatted).toContain("./file1.ts");
  expect(result.formatted).not.toContain("--");
  expect(result.formatted).toContain("function two() {");
  expect(result.formatted).toContain("./file2.ts");
});

test("increases indentation when original is less than 2 spaces", () => {
  const input = `./minimal-indent.ts
function test() {
 singleSpaceIndent();
}`;

  const result = formatGrepSearchResults(input);

  expect(result.formatted).toContain("  function test() {");
  expect(result.formatted).toContain("   singleSpaceIndent();");
  expect(result.formatted).toContain("  }");
});

test("decreases indentation when original is more than 2 spaces", () => {
  const input = `./excessive-indent.ts
      function test() {
        tooMuchIndent();
      }`;

  const result = formatGrepSearchResults(input);

  expect(result.formatted).toContain("  function test() {");
  expect(result.formatted).toContain("    tooMuchIndent();");
  expect(result.formatted).toContain("  }");
});
