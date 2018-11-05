<?php
/**
 * @author Andru Cherny <acherny@minexsystems.com>
 * @date: 05.11.18 - 13:48
 */


$config = json_decode(file_get_contents('test.json'), true);

echo "Booting---> " . ($config['bootTime'] / 1000000)."s\n";

usleep($config['bootTime']);

while(true) {
  $config = json_decode(file_get_contents('test.json'), true);
  echo "Sleep-----> " . ($config['sleep'] / 1000000)."s\n";
  usleep($config['sleep']);
  if($config['isDie']) {
    echo "Die\n\r";
    die;
  }
}
