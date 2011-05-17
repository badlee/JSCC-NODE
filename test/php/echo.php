/*Love*/
class test {
	private $foo = 'hello world';
	function hi() {
		echo $this->foo;
	}
}

$foo = new test();
$foo->hi();
